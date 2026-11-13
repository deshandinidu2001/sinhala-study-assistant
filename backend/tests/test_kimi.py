import json
from unittest.mock import patch
import httpx
import pytest
from backend import kimi, gemini
from backend.tests.test_summaries import summary_draft, StudySummary


def test_kimi_sends_schema_and_validates_response():
    payload = summary_draft().model_dump_json()
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": payload}}]}))
    client = httpx.Client(transport=transport)
    with patch.object(kimi.httpx, "Client", return_value=client):
        result = kimi.generate("Only source text", {"language": "Sinhala"}, StudySummary)
        assert result.title == "Photosynthesis essentials"


@pytest.mark.parametrize("body", [{}, {"choices": [{"finish_reason": "length", "message": {"content": "{}"}}]}, {"choices": [{"finish_reason": "stop", "message": {"content": "invalid"}}]}])
def test_kimi_rejects_malformed_and_truncated_responses(body):
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=body))
    client = httpx.Client(transport=transport)
    with patch.object(kimi.httpx, "Client", return_value=client):
        with pytest.raises(gemini.GeminiUnavailable, match="Kimi"):
            kimi.generate("Summarize", {}, StudySummary)

def test_generation_schema_keeps_structure_without_nested_size_grammar():
    from backend.gemini import generation_schema
    from backend.summaries import StudySummary
    schema = generation_schema(StudySummary)
    assert schema["required"] == ["title", "sections", "key_terms", "revision_points"]
    assert "maxLength" not in json.dumps(schema)
    assert "maxItems" not in json.dumps(schema)
    assert StudySummary.model_fields["sections"].metadata
