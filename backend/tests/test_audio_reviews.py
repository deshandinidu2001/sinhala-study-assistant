import base64
import io
import json
import wave
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from backend import audio_reviews as audio
from backend.db.session import get_db
from backend.main import create_app
from backend.study import StudyError


def recording():
    output = io.BytesIO()
    with wave.open(output, "wb") as f:
        f.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
        f.writeframes(b"\x01\x00" * 2400)
    return output.getvalue()


@pytest.fixture
def summary():
    return {"title": "Plant review", "language": "en", "sections": [{"heading": "Food", "points": [{"text": "Plants make glucose.", "source": {"page": 1}}]}],
            "key_terms": [{"term": "Roots", "text": "Roots absorb water."}], "revision_points": [{"text": "Remember chlorophyll."}]}


def test_narration_uses_all_validated_text_and_rejects_oversize(summary):
    script = audio.review_text(summary)
    assert "Plants make glucose." in script and "Roots. Roots absorb water." in script
    assert "Remember chlorophyll." in script and "source" not in script
    summary["sections"][0]["points"][0]["text"] = "x" * 10_001
    with pytest.raises(StudyError, match="දිග"):
        audio.review_text(summary)


def test_cache_reused_and_partitioned_by_text_language_model(summary, tmp_path, monkeypatch):
    monkeypatch.setattr(audio, "document_folder", lambda _: tmp_path)
    settings = SimpleNamespace(gemini_tts_model="test-model")
    monkeypatch.setattr(audio, "get_settings", lambda: settings)
    with patch.object(audio, "synthesize", return_value=recording()) as generate:
        first = audio.make_audio(uuid4(), summary)
        assert audio.cached_audio(first["document_id"], summary) == first
        assert audio.make_audio(first["document_id"], summary) == first
        assert generate.call_count == 1
        assert first["duration_seconds"] == 0.1
        summary["language"] = "si"
        assert audio.cached_audio(first["document_id"], summary) is None
        summary["language"] = "en"
        settings.gemini_tts_model = "other-model"
        assert audio.cached_audio(first["document_id"], summary) is None
        settings.gemini_tts_model = "test-model"
        summary["title"] = "Changed material"
        assert audio.cached_audio(first["document_id"], summary) is None
    assert not list(tmp_path.glob("*.tmp"))


@pytest.mark.parametrize("body", [
    {"status": "in_progress", "steps": []},
    {"status": "completed", "steps": []},
    {"status": "completed", "steps": [{"type": "model_output", "content": [{"type": "audio", "data": "%%%"}]}]},
    {"status": "completed", "steps": [{"type": "model_output", "content": [{"type": "audio", "data": base64.b64encode(b"broken wav").decode()}]}]},
])
def test_provider_rejects_incomplete_invalid_audio_without_exposing_data(body, monkeypatch):
    monkeypatch.setattr(audio, "get_settings", lambda: SimpleNamespace(gemini_tts_model="tts", gemini_api_key=SecretStr("private-key")))
    with patch("httpx.Client.post", return_value=httpx.Response(200, json=body, request=httpx.Request("POST", "https://example.com"))):
        with pytest.raises(audio.AudioUnavailable) as error:
            audio.synthesize("Private notes")
    assert "private" not in str(error.value)


def test_provider_sends_transcript_and_decodes_complete_wav(monkeypatch):
    monkeypatch.setattr(audio, "get_settings", lambda: SimpleNamespace(gemini_tts_model="tts", gemini_api_key=SecretStr("private-key")))
    payload = {"status": "completed", "steps": [{"type": "model_output", "content": [{"type": "audio", "data": base64.b64encode(recording()).decode()}]}]}
    with patch("httpx.Client.post", return_value=httpx.Response(200, json=payload, request=httpx.Request("POST", "https://example.com"))) as post:
        assert audio.synthesize("සිංහල පාඩම") == recording()
        assert post.call_args.kwargs["json"]["input"][0]["content"][0]["text"] == "සිංහල පාඩම"
        assert post.call_args.kwargs["json"]["store"] is False


def test_failed_generation_never_saves_partial_cache(summary, tmp_path, monkeypatch):
    monkeypatch.setattr(audio, "document_folder", lambda _: tmp_path)
    with patch.object(audio, "synthesize", side_effect=audio.AudioUnavailable(audio.UNAVAILABLE)):
        with pytest.raises(audio.AudioUnavailable):
            audio.make_audio(uuid4(), summary)
    assert not list(tmp_path.iterdir())


def test_missing_key_is_actionable(monkeypatch):
    monkeypatch.setattr(audio, "get_settings", lambda: SimpleNamespace(gemini_api_key=SecretStr("")))
    with pytest.raises(audio.AudioUnavailable, match="GEMINI_API_KEY"):
        audio.synthesize("notes")


def test_audio_routes_require_ready_document_and_server_summary(summary, tmp_path):
    app = create_app()
    app.dependency_overrides[get_db] = lambda: None
    doc = SimpleNamespace(id=uuid4(), status="processing")
    with TestClient(app) as client, patch("backend.routes.require_document", return_value=doc), patch("backend.routes.cached_summary", return_value=summary), patch("backend.routes.document_folder", return_value=tmp_path):
        url = f"/documents/{doc.id}/audio-review"
        assert client.post(url, json={}).status_code == 409
        doc.status = "ready"
        with patch("backend.routes.cached_summary", return_value=None):
            assert client.post(url, json={}).status_code == 409
        with patch.object(audio, "make_audio", return_value={"id": "saved"}) as make:
            assert client.post(url, json={"language": "en", "text": "untrusted"}).json() == {"id": "saved"}
            assert make.call_args.args[1] == summary
        assert client.get(f"/documents/{doc.id}/audio/invalid").status_code == 422
        identity = "a" * 64
        assert client.get(f"/documents/{doc.id}/audio/{identity}").status_code == 404
        (tmp_path / f"audio-{identity}.wav").write_bytes(recording())
        response = client.get(f"/documents/{doc.id}/audio/{identity}", headers={"Range": "bytes=0-43"})
        assert response.status_code == 206 and response.content[:4] == b"RIFF"
        assert "attachment" in client.get(f"/documents/{doc.id}/audio/{identity}?download=true").headers["content-disposition"]
