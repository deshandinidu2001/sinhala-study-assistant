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
    for question in ["ජීව පටක යනු කුමක්ද?", "What is photosynthesis?", "What is AI?"]:
        assert normalize_question(question) == (question, "original")
    assert normalize_question("jiwa pataka", "original") == ("jiwa pataka", "original")


def test_explicit_singlish_converts_unknown_words_and_keeps_numbers():
    assert normalize_question("mama 11?", "singlish")[0] == "මම 11?"
    assert "ජීව පටක" in normalize_question("ජීව pataka kiyanne?")[0]


@pytest.mark.parametrize("question", ["rudira patakaye karyan mnd", "rudhira pathakaye karyayan monawada", "RUDIRA PATAKAYE KARYAN MNWD"])
def test_reported_tissue_function_question(question):
    converted, _ = normalize_question(question)
    assert relevance(converted, "රුධිර පටකයේ කාර්යයන් වන්නේ ඔක්සිජන් හා පෝෂක ද්‍රව්‍ය ප්‍රවාහනය කිරීමයි.") >= 0.6
    assert "මොනවාද" in converted


def test_source_vocabulary_handles_unlisted_sinhala_terms():
    from backend.singlish import romanize, phonetic
    assert phonetic(romanize("ශ්වසනය")) == phonetic("swasanaya")
    converted, _ = normalize_question("swasanaya saha sanchalanaya wenasa mkd", vocabulary={"ශ්වසනය", "සංචලනය"})
    assert "ශ්වසනය" in converted and "සංචලනය" in converted
    assert normalize_question("What is swasanaya?", vocabulary={"ශ්වසනය"})[1] == "original"


def test_ambiguous_source_spellings_do_not_guess():
    from backend.singlish import _source_word
    assert _source_word("samana", {"samanaya": "සමානය", "samanawa": "සමානව"}) is None
