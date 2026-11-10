"""Extraction and grounding regression checks; no external AI service."""
from pathlib import Path
from unittest.mock import patch

import pytest
from docx import Document
from pypdf import PdfWriter
from pypdf.generic import ArrayObject, DecodedStreamObject, DictionaryObject, NameObject

from backend.study import StudyError, chunks, extract_pages, normalize, relevance, vector, words


def write_pdf(path: Path) -> None:
    writer = PdfWriter()
    for text in ["Photosynthesis uses sunlight to produce glucose in green plants.", "Chlorophyll absorbs light energy inside the chloroplast."]:
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 30 700 Td ({text}) Tj ET".encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)


def test_unicode_and_sinhala_conjuncts_are_preserved() -> None:
    assert normalize("\ufeff  ශ්‍රී\u200b ලංකාව \u200d ") == "ශ්‍රී ලංකාව"
    assert "ප්‍රභාසංස්ලේෂණය" in words("ප්‍රභාසංස්ලේෂණය යනු කුමක්ද?")
    assert len(vector("ශ්‍රී ලංකාව")) == 1024
    assert vector("ශ්‍රී ලංකාව") == vector("ශ්‍රී ලංකාව")
    assert vector("ශ්‍රී ලංකාව") == vector("ශ්රී ලංකාව")


def test_sinhala_relevance_rejects_unrelated_questions() -> None:
    note = "ප්‍රභාසංස්ලේෂණය සඳහා ශාක සූර්යාලෝකය භාවිත කරයි."
    assert relevance("ප්‍රභාසංස්ලේෂණය යනු කුමක්ද?", note) == 1
    assert relevance("ගිනිකඳු යනු කුමක්ද?", note) == 0


def test_pdf_keeps_real_source_page_numbers(tmp_path: Path) -> None:
    path = tmp_path / "notes.pdf"
    write_pdf(path)
    pages, method = extract_pages(path)
    assert method == "text"
    assert [p["page"] for p in pages] == [1, 2]
    assert "Photosynthesis" in pages[0]["text"]
    assert "Chlorophyll" in pages[1]["text"]


def test_utf16_and_explicit_text_sections(tmp_path: Path) -> None:
    path = tmp_path / "notes.txt"
    path.write_bytes("ප්‍රභාසංස්ලේෂණය සඳහා ශාක සූර්යාලෝකය භාවිත කරයි.\fහරිතප්‍රද මගින් ආලෝක ශක්තිය අවශෝෂණය කරයි.".encode("utf-16"))
    pages, _ = extract_pages(path)
    assert len(pages) == 2
    assert "හරිතප්‍රද" in pages[1]["text"]


def test_word_paragraphs_and_tables_are_read(tmp_path: Path) -> None:
    path = tmp_path / "notes.docx"
    document = Document()
    document.add_paragraph("Plants use sunlight to produce food through photosynthesis.")
    table = document.add_table(rows=1, cols=1)
    table.cell(0, 0).text = "Chlorophyll absorbs light energy."
    document.save(path)
    pages, method = extract_pages(path)
    assert method == "sections"
    assert "Chlorophyll" in pages[0]["text"]


def test_empty_invalid_and_encrypted_inputs_are_actionable(tmp_path: Path) -> None:
    empty = tmp_path / "empty.txt"
    empty.write_text(" ")
    with pytest.raises(StudyError, match="අකුරු හමු නොවීය"):
        extract_pages(empty)
    invalid = tmp_path / "invalid.txt"
    invalid.write_bytes(b"\xff\x80not unicode")
    with pytest.raises(StudyError, match="UTF-8"):
        extract_pages(invalid)
    encrypted = tmp_path / "locked.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.encrypt("secret")
    writer.write(encrypted)
    with pytest.raises(StudyError, match="මුරපද"):
        extract_pages(encrypted)


def test_long_paragraphs_are_not_dropped_by_chunking() -> None:
    text = "photosynthesis " * 600
    result = chunks(text)
    assert len(result) > 2
    assert all(len(part) <= 1700 for part in result)
    assert result[-1].endswith("photosynthesis")


def test_legacy_font_with_latin_unicode_map_uses_ocr(tmp_path: Path) -> None:
    from backend.pdf_pages import has_legacy_sinhala_font, render_page
    path = tmp_path / "legacy.pdf"
    write_pdf(path)
    from pypdf import PdfReader
    reader = PdfReader(path)
    reader.pages[0]["/Resources"]["/Font"]["/F1"][NameObject("/BaseFont")] = NameObject("/ABCDEF+FMAbhayax")
    assert has_legacy_sinhala_font(reader.pages[0])
    writer = PdfWriter()
    writer.append_pages_from_reader(reader)
    writer.write(path)
    with patch("backend.study.ocr", return_value="ජීව පටක යනු සමාන කෘත්‍යයක් ඉටු කරන සෛල සමූහයකි.") as mocked:
        pages, method = extract_pages(path)
    assert mocked.call_count == 1
    assert method == "text+ocr" and pages[0]["ocr"]
    assert "ජීව පටක" in pages[0]["text"]
    assert render_page(path, 2).startswith(b"\x89PNG")
    with pytest.raises(IndexError):
        render_page(path, 0)
