"""Saved narration of a server-validated summary; never accept arbitrary speech text."""
import base64
import hashlib
import io
import json
import logging
import threading
import wave
from datetime import datetime, timezone
from uuid import uuid4

import httpx

from backend.config import get_settings
from backend.study import StudyError, document_folder

logger = logging.getLogger(__name__)
NO_KEY = "හඬ සමාලෝචනය සඳහා GEMINI_API_KEY එක් කර backend නැවත අරඹන්න."
UNAVAILABLE = "හඬ සමාලෝචනය සෑදිය නොහැක. Gemini සේවාව සහ TTS ප්‍රවේශය පරීක්ෂා කර නැවත උත්සාහ කරන්න."
TOO_LONG = "හඬ සමාලෝචනයට මෙම සාරාංශය දිග වැඩියි. කෙටි සාරාංශයක් හෝ විශේෂ මාතෘකාවක් තෝරන්න."
LOCKS = [threading.Lock() for _ in range(16)]


class AudioUnavailable(Exception):
    pass


def review_text(summary: dict) -> str:
    lines = [summary["title"]]
    for section in summary["sections"]:
        lines.extend([section["heading"], *(point["text"] for point in section["points"])])
    if summary["key_terms"]:
        lines.append("ප්‍රධාන වචන." if summary["language"] == "si" else "Key terms.")
        lines.extend(f"{term['term']}. {term['text']}" for term in summary["key_terms"])
    lines.append("මතක තබාගන්න." if summary["language"] == "si" else "For revision.")
    lines.extend(point["text"] for point in summary["revision_points"])
    text = "\n\n".join(lines)
    if len(text) > 10_000:
        raise StudyError(TOO_LONG)
    return text


def review_id(summary: dict) -> str:
    identity = [review_text(summary), summary["language"], get_settings().gemini_tts_model, "Kore", 1]
    return hashlib.sha256(json.dumps(identity, ensure_ascii=False).encode()).hexdigest()


def cached_audio(document_id, summary: dict) -> dict | None:
    identity = review_id(summary)
    folder = document_folder(document_id)
    try:
        data = json.loads((folder / f"audio-{identity}.json").read_text(encoding="utf-8"))
        if (folder / f"audio-{identity}.wav").is_file():
            return data
    except (OSError, ValueError):
        pass
    return None


def validate_wav(audio: bytes) -> float:
    if not audio or len(audio) > 40_000_000:
        raise ValueError("Invalid audio size")
    with wave.open(io.BytesIO(audio), "rb") as recording:
        frames, rate = recording.getnframes(), recording.getframerate()
        if (recording.getnchannels(), recording.getsampwidth(), rate) != (1, 2, 24000):
            raise ValueError("Unexpected audio format")
        if not 0 < frames / rate <= 900 or len(recording.readframes(frames)) != frames * 2:
            raise ValueError("Incomplete audio")
        return round(frames / rate, 2)


def synthesize(text: str) -> bytes:
    settings = get_settings()
    if not settings.gemini_api_key.get_secret_value().strip():
        raise AudioUnavailable(NO_KEY)
    payload = {
        "model": settings.gemini_tts_model,
        "input": [{"type": "user_input", "content": [{"type": "text", "text": text,
            "annotations": [{"type": "speech_metadata", "style": "Clear, warm study revision narration at a relaxed pace."}]}]}],
        "response_format": {"type": "audio", "mime_type": "audio/wav", "sample_rate": 24000},
        "generation_config": {"speech_config": [{"voice": "Kore"}]},
        "store": False,
    }
    try:
        with httpx.Client(timeout=httpx.Timeout(120, connect=10), follow_redirects=False) as client:
            response = client.post("https://generativelanguage.googleapis.com/v1beta/interactions",
                headers={"x-goog-api-key": settings.gemini_api_key.get_secret_value()}, json=payload)
            response.raise_for_status()
        result = response.json()
        if result.get("status") != "completed":
            raise ValueError("Incomplete speech")
        parts = [part for step in result["steps"] if step.get("type") == "model_output"
                 for part in step.get("content", []) if part.get("type") == "audio"]
        if len(parts) != 1 or len(parts[0]["data"]) > 54_000_000:
            raise ValueError("Missing or oversized speech")
        audio = base64.b64decode(parts[0]["data"], validate=True)
        validate_wav(audio)
        return audio
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, AttributeError, wave.Error, EOFError) as error:
        logger.warning("Audio generation unavailable (%s)", type(error).__name__)
        raise AudioUnavailable(UNAVAILABLE) from None


def make_audio(document_id, summary: dict) -> dict:
    identity = review_id(summary)
    with LOCKS[int(identity[:2], 16) % len(LOCKS)]:
        existing = cached_audio(document_id, summary)
        if existing:
            return existing
        text = review_text(summary)
        audio = synthesize(text)
        data = {"id": identity, "document_id": str(document_id), "language": summary["language"],
                "text": text, "duration_seconds": validate_wav(audio),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "url": f"/documents/{document_id}/audio/{identity}"}
        folder = document_folder(document_id)
        # Unique temporary files + atomic replacement never expose partial recordings.
        temporary = folder / f"audio-{uuid4()}.tmp"
        metadata = folder / f"audio-{uuid4()}.tmp"
        try:
            temporary.write_bytes(audio)
            metadata.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            temporary.replace(folder / f"audio-{identity}.wav")
            metadata.replace(folder / f"audio-{identity}.json")
        finally:
            temporary.unlink(missing_ok=True)
            metadata.unlink(missing_ok=True)
        return data
