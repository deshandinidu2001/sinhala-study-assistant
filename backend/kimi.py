"""Validated, server-side OpenAI-compatible Docker Model Runner adapter."""
import json
import logging
import httpx
from pydantic import BaseModel
from backend.config import get_settings
from backend.gemini import GeminiUnavailable

logger = logging.getLogger(__name__)
KIMI_UNAVAILABLE = "Kimi වෙත සම්බන්ධ විය නොහැක. Docker හි ආකෘතිය ධාවනය කරන්න හෝ Gemini තෝරන්න."


def generate(instruction: str, data: dict, schema: type[BaseModel], **kwargs) -> BaseModel:
    settings = get_settings()
    payload = {
        "model": settings.kimi_model,
        "messages": [{"role": "system", "content": instruction},
                     {"role": "user", "content": json.dumps(data, ensure_ascii=False)}],
        "max_tokens": kwargs.get("max_output_tokens", 24000),
        "response_format": {"type": "json_schema", "json_schema": {
            "name": schema.__name__, "strict": True, "schema": schema.model_json_schema()}},
        "stream": False,
    }
    try:
        with httpx.Client(timeout=settings.kimi_timeout_seconds, follow_redirects=False) as client:
            response = client.post(settings.kimi_base_url.rstrip("/") + "/chat/completions", json=payload)
            response.raise_for_status()
        choice = response.json()["choices"][0]
        if choice.get("finish_reason") != "stop":
            raise ValueError("Incomplete output")
        return schema.model_validate_json(choice["message"]["content"])
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, AttributeError) as error:
        logger.warning("Kimi request unavailable (%s)", type(error).__name__)
        raise GeminiUnavailable(KIMI_UNAVAILABLE) from None
