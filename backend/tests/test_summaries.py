import json
from uuid import uuid4
from unittest.mock import patch

import pytest

from backend import gemini
from backend.db.models import Document
from backend.summaries import StudySummary, cached_summary, make_summary, summary_material
from backend.study import StudyError

TEXT = "Photosynthesis uses sunlight to produce glucose in green plants. Chlorophyll absorbs light energy in green leaves. Roots absorb water and minerals from the soil."


def summary_draft():
    point = {"text": "Green plants use light energy to produce glucose through photosynthesis.", "source_number": 1, "evidence_quote": TEXT[:63]}
    return StudySummary.model_validate({"title": "Photosynthesis essentials", "sections": [
        {"heading": "Energy and food", "points": [point, point]}, {"heading": "Plant structures", "points": [point, point]}],
        "key_terms": [{"term": "Photosynthesis", "definition": point}, {"term": "Chlorophyll", "definition": point}],
        "revision_points": [point, point]})


@pytest.fixture
def document(tmp_path, monkeypatch):
    monkeypatch.setattr("backend.summaries.document_folder", lambda document_id: tmp_path)
    (tmp_path / "pages.json").write_text(json.dumps([{"page": 1, "text": TEXT}, {"page": 2, "text": TEXT}]), encoding="utf-8")
    return Document(id=uuid4(), title="Science", filename="science.pdf", status="ready", extraction_method="text", page_count=2)


def test_summary_has_citations_and_reuses_cache_only_for_same_content_language_focus(document, tmp_path):
    with patch.object(gemini, "configured", return_value=True), patch.object(gemini, "generate", side_effect=lambda *args, **kwargs: summary_draft()) as generate:
        first = make_summary(document, "en", "functions")
        assert first["coverage"]["included_pages"] == 2
        assert first["sections"][0]["points"][0]["source"]["document_id"] == str(document.id)
        assert cached_summary(document, "en", "functions") == first
        assert make_summary(document, "en", "functions") == first
        assert generate.call_count == 1
        assert cached_summary(document, "si", "functions") is None
        assert cached_summary(document, "en", "definitions") is None
        (tmp_path / "pages.json").write_text(json.dumps([{"page": 1, "text": TEXT + " New material."}]), encoding="utf-8")
        assert cached_summary(document, "en", "functions") is None
        make_summary(document, "en", "functions")
        assert generate.call_count == 2


def test_summary_ignores_unsupported_points_but_never_saves_an_unsupported_summary(document, tmp_path):
    value = summary_draft()
    value.sections[0].points[0].evidence_quote = "Fabricated unsupported evidence that does not appear in the document."
    with patch.object(gemini, "configured", return_value=True), patch.object(gemini, "generate", return_value=value):
        result = make_summary(document, "en")
        assert len(result["sections"][0]["points"]) == 1
    value = summary_draft()
    for section in value.sections:
        for point in section.points:
            point.evidence_quote = "Fabricated unsupported evidence that does not appear in the document."
    with patch.object(gemini, "configured", return_value=True), patch.object(gemini, "generate", return_value=value):
        with pytest.raises(StudyError):
            make_summary(document, "si", regenerate=True)
        assert cached_summary(document, "si", "") is None


def test_summary_material_covers_pages_with_bounded_provider_input(document, tmp_path):
    (tmp_path / "pages.json").write_text(json.dumps([{"page": i + 1, "text": TEXT * 100} for i in range(150)]), encoding="utf-8")
    sources, coverage, _ = summary_material(document)
    assert len(sources) == 150 and sources[-1]["page"] == 150
    assert sum(len(source["text"]) for source in sources) <= 72_000
    assert coverage["text_truncated"]


def test_summary_missing_key_and_unreadable_text_are_actionable(document, tmp_path):
    with patch.object(gemini, "configured", return_value=False):
        with pytest.raises(gemini.GeminiUnavailable):
            make_summary(document, "en")
    (tmp_path / "pages.json").write_text("[]", encoding="utf-8")
    with pytest.raises(StudyError):
        summary_material(document)

def test_options_partition_cache_and_reach_prompt(document):
    from backend.summaries import SummaryOptions
    with patch.object(gemini, "configured", return_value=True), patch.object(gemini, "generate", side_effect=lambda *a, **kw: summary_draft()) as generate:
        options = SummaryOptions(length="long", include=["comparisons"])
        result = make_summary(document, "en", options=options)
        assert result["options"]["length"] == "long"
        assert result["key_terms"] == []
        assert generate.call_args.args[1]["include"] == ["comparisons"]
        assert "PARAGRAPHS" in generate.call_args.args[0]
        assert "Selected paragraph length: long" in generate.call_args.args[0]
        assert cached_summary(document, "en", "") is None
        assert cached_summary(document, "en", "", options) == result


def test_sinhala_language_failure_retries_without_caching_english(document):
    with patch.object(gemini, "configured", return_value=True), patch.object(gemini, "generate", side_effect=lambda *a, **kw: summary_draft()) as generate:
        with pytest.raises(StudyError, match="භාෂාව"):
            make_summary(document, "si")
        assert generate.call_count == 2
        assert cached_summary(document, "si", "") is None


def test_sinhala_retry_keeps_original_english_evidence(document):
    good = summary_draft()
    for section in good.sections:
        section.heading = "ප්‍රභාසංස්ලේෂණ ක්‍රියාවලිය"
        for point in section.points:
            point.text = "හරිත ශාක හිරු එළියේ ශක්තිය භාවිතයෙන් ආහාර නිපදවයි. මෙම ක්‍රියාවලිය ප්‍රභාසංස්ලේෂණය ලෙස හැඳින්වේ."
    with patch.object(gemini, "configured", return_value=True), patch.object(gemini, "generate", side_effect=[gemini.GeminiUnavailable(), good]) as generate:
        result = make_summary(document, "si")
        assert generate.call_count == 2
        assert result["sections"][0]["points"][0]["source"]["page"] == 1


def test_kimi_selection_does_not_require_gemini_key(document):
    from backend import kimi
    from backend.summaries import SummaryOptions
    with patch.object(gemini, "configured", return_value=False), patch.object(kimi, "generate", return_value=summary_draft()) as generate:
        result = make_summary(document, "en", options=SummaryOptions(provider="kimi"))
        assert result["mode"] == "kimi"
        assert generate.call_count == 1
