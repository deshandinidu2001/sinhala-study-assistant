import json
from unittest.mock import patch

import httpx
import pytest

from backend import gemini
from backend.config import get_settings


@pytest.fixture(autouse=True)
def configuration(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-private-key")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def response(data, finish="STOP"):
    return {"candidates": [{"finishReason": finish, "content": {"parts": [{"text": json.dumps(data, ensure_ascii=False)}]}}]}


def transport(monkeypatch, handler):
    client = httpx.Client
    monkeypatch.setattr(gemini.httpx, "Client", lambda **kwargs: client(transport=httpx.MockTransport(handler), **kwargs))


def test_rest_contract_and_server_only_key(monkeypatch):
    def handler(request):
        assert request.url.scheme == "https"
        assert request.url.host == "generativelanguage.googleapis.com"
        assert "key=" not in str(request.url)
        assert request.headers["x-goog-api-key"] == "test-private-key"
        body = json.loads(request.content)
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        assert body["generationConfig"]["responseJsonSchema"]["required"] == ["question"]
        assert "MKD" in body["contents"][0]["parts"][0]["text"]
        return httpx.Response(200, json=response({"question": "ජීව පටක කියන්නේ මොකක්ද?"}))
    transport(monkeypatch, handler)
    question, method, notice = gemini.interpret("MKD JIWA PATAKA KIYANNE", "auto")
    assert "ජීව පටක" in question and method == "gemini" and notice is None
    assert "test-private-key" not in repr(get_settings())


@pytest.mark.parametrize("status,data", [
    (401, {"error": "private-provider-error"}), (429, {}), (503, {}),
    (200, {}), (200, {"candidates": [None]}), (200, response({"question": "x"})),
    (200, response({"question": "ජීව පටක"}, "SAFETY")),
])
def test_provider_failures_keep_local_singlish_working(monkeypatch, caplog, status, data):
    transport(monkeypatch, lambda request: httpx.Response(status, json=data))
    question, method, notice = gemini.interpret("jiwa pataka kiyanne mokakda", "singlish")
    assert "ජීව පටක" in question and method == "offline" and notice
    assert "test-private-key" not in caplog.text and "private-provider-error" not in caplog.text


def test_timeout_falls_back_without_losing_question(monkeypatch):
    def handler(request):
        raise httpx.ReadTimeout("provider timeout", request=request)
    transport(monkeypatch, handler)
    assert gemini.interpret("jiwa pataka", "singlish")[1:] == ("offline", gemini.FALLBACK_NOTICE)


def test_no_key_or_original_language_never_calls_provider(monkeypatch):
    with patch.object(gemini, "generate") as generate:
        assert gemini.interpret("jiwa pataka", "original")[0] == "jiwa pataka"
        monkeypatch.setenv("GEMINI_API_KEY", "")
        get_settings.cache_clear()
        assert gemini.interpret("jiwa pataka", "singlish")[1] == "offline"
        assert gemini.explain("question", [{"excerpt": "source"}]) is None
        generate.assert_not_called()


def test_explanation_requires_real_source_references():
    sources = [{"excerpt": "ජීව පටක යනු සෛල සමූහයකි."}]
    with patch.object(gemini, "generate", return_value=gemini.GroundedAnswer(supported=True, answer="සෛල සමූහයකි. [1]", citations=[1])):
        assert gemini.explain("ජීව පටක?", sources).endswith("[1]")
    for answer, citations in [("කල්පිත පිළිතුරක් [7]", [7]), ("මූලාශ්‍ර නැත", [1]), ("පිළිතුර [1]", [2])]:
        with patch.object(gemini, "generate", return_value=gemini.GroundedAnswer(supported=True, answer=answer, citations=citations)):
            with pytest.raises(gemini.GeminiUnavailable):
                gemini.explain("ජීව පටක?", sources)
    with patch.object(gemini, "generate") as generate:
        assert gemini.explain("unrelated question", []) is None
        generate.assert_not_called()
