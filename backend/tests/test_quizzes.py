"""MCQ quality contracts and provider-independent source validation."""
from unittest.mock import patch

import pytest

from backend import gemini
from backend.quizzes import Draft, Question, Review, INVALID, validate_draft, make_mcq_quiz
from backend.study import StudyError

EVIDENCE = "Photosynthesis uses sunlight to produce glucose in green plants. Chlorophyll absorbs light energy in the leaves."
SOURCES = [{"number": 1, "document_id": "test-source", "title": "Science", "page": 2, "section": False, "text": EVIDENCE}]


def draft(count=5, language="en"):
    stems = [
        "Which process allows a green plant to produce glucose using light energy?",
        "What is the main role of chlorophyll in photosynthesis?",
        "A plant is kept in darkness. Which process will be directly limited?",
        "How does sunlight contribute to glucose production in green leaves?",
        "Which pair correctly links a leaf pigment with its function?",
    ]
    return Draft(questions=[Question(
        prompt=stems[index] if language == "en" else (f"සිසුවෙකු ශාකයක් අඳුරේ තැබූ විට ආහාර නිපදවීම වෙනස් වන්නේ කෙසේද? ({index + 1})" if index == 2 else f"හරිත ශාකවල ආහාර නිපදවීම පිළිබඳ නිවැරදි ප්‍රකාශය කුමක්ද? ({index + 1})"),
        options=["Photosynthesis", "Respiration", "Transpiration", "Absorption"], answer_index=0,
        explanation="Photosynthesis uses light energy to produce glucose, as described in the source passage.",
        option_explanations=["This process produces glucose using light.", "This process releases energy rather than producing glucose from light.", "This describes water loss rather than glucose production.", "This describes uptake of substances rather than glucose production."],
        skill="application" if index == 2 else "knowledge" if index == 0 else "understanding", source_number=1,
        evidence_quote=EVIDENCE[:62],
    ) for index in range(count)])


@pytest.mark.parametrize("change", [
    lambda value: setattr(value.questions[0], "prompt", "Choose the missing word in this sentence ________?"),
    lambda value: setattr(value.questions[0], "options", ["same", "SAME", "different", "other"]),
    lambda value: setattr(value.questions[0], "source_number", 99),
    lambda value: setattr(value.questions[0], "evidence_quote", "A fabricated quote that never appears in the provided source."),
    lambda value: setattr(value.questions[0], "option_explanations", ["too short"] * 4),
    lambda value: setattr(value.questions[0], "options", ["All of the above", "A", "B", "C"]),
    lambda value: setattr(value.questions[1], "prompt", value.questions[0].prompt),
    lambda value: [setattr(question, "skill", "knowledge") for question in value.questions],
    lambda value: setattr(value.questions[2], "prompt", "What is the main role of chlorophyll in photosynthesis?"),
])
def test_rejects_bad_questions_before_saving(change):
    value = draft()
    change(value)
    with pytest.raises(StudyError, match=INVALID):
        validate_draft(value, SOURCES, 5, "en")


def test_counts_language_and_quotes_are_validated():
    validate_draft(draft(), SOURCES, 5, "en")
    with pytest.raises(StudyError):
        validate_draft(draft(), SOURCES, 4, "en")
    with pytest.raises(StudyError):
        validate_draft(draft(), SOURCES, 5, "si")
    with pytest.raises(StudyError):
        validate_draft(Draft(questions=[]), SOURCES, 5, "en")


def test_generation_is_reviewed_and_option_feedback_stays_aligned():
    value = draft()
    with patch("backend.quizzes.source_material", return_value=SOURCES), patch.object(gemini, "configured", return_value=True), patch.object(gemini, "generate", side_effect=[value, Review(accepted_indices=list(range(5)))]) as generate:
        result = make_mcq_quiz(None, None, None, language="en")
    assert generate.call_count == 2
    assert generate.call_args_list[0].kwargs["model"] == gemini.get_settings().gemini_quiz_model
    for question in result:
        assert question["options"][question["answer_index"]] == "Photosynthesis"
        assert question["option_explanations"][question["answer_index"]] == value.questions[0].option_explanations[0]
        assert question["source"]["page"] == 2 and question["grade"] == 11 and question["kind"] == "mcq"


def test_review_failure_does_not_return_cloze_fallback():
    with patch("backend.quizzes.source_material", return_value=SOURCES), patch.object(gemini, "configured", return_value=True), patch.object(gemini, "generate", side_effect=[draft(), Review(accepted_indices=[0, 2])]):
        with pytest.raises(StudyError, match=INVALID):
            make_mcq_quiz(None, None, None, language="en")


def test_missing_key_and_provider_failure_do_not_return_old_exercises():
    with patch("backend.quizzes.source_material", return_value=SOURCES), patch.object(gemini, "configured", return_value=False), patch.object(gemini, "generate") as generate:
        with pytest.raises(gemini.GeminiUnavailable):
            make_mcq_quiz(None, None, None, language="en")
        generate.assert_not_called()
    with patch("backend.quizzes.source_material", return_value=SOURCES), patch.object(gemini, "configured", return_value=True), patch.object(gemini, "generate", side_effect=gemini.GeminiUnavailable):
        with pytest.raises(gemini.GeminiUnavailable):
            make_mcq_quiz(None, None, None, language="en")


def test_evidence_alignment_recovers_exact_source_and_rejects_fabrication():
    from backend.quizzes import align_evidence
    value = draft(1)
    value.questions[0].source_number = 99
    align_evidence(value, SOURCES)
    assert value.questions[0].source_number == 1
    assert value.questions[0].evidence_quote in EVIDENCE
    value.questions[0].evidence_quote = "An invented quote with no meaningful overlap with the original source."
    align_evidence(value, SOURCES)
    with pytest.raises(StudyError):
        validate_draft(value, SOURCES, 1, "en")
