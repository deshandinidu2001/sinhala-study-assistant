import pytest
from backend.singlish import normalize_question
from backend.study import relevance


@pytest.mark.parametrize("question", ["MKD JIWA PATAKA KIYANNE", "mokakda jeewa pathaka kiyanne", "jiiwa pataka yanu kumakda?"])
def test_common_singlish_spellings_match_sinhala_sources(question):
    converted, method = normalize_question(question)
    assert "ජීව පටක" in converted
    assert method == "offline"
    assert relevance(converted, "ජීව පටක යනු සමාන කෘත්‍යයක් ඉටු කරන සෛල සමූහයකි.") >= 0.3


def test_native_sinhala_and_english_remain_unchanged():
    for question in ["ජීව පටක යනු කුමක්ද?", "What is photosynthesis?"]:
        assert normalize_question(question) == (question, "original")
    assert normalize_question("jiwa pataka", "original") == ("jiwa pataka", "original")


def test_explicit_singlish_converts_unknown_words_and_keeps_numbers():
    assert normalize_question("mama 11?", "singlish")[0] == "මම 11?"
    assert "ජීව පටක" in normalize_question("ජීව pataka kiyanne?")[0]
