"""Render original PDF pages with embedded fonts, independent of extracted text."""
import io
import re
from pathlib import Path
from threading import RLock

import pypdfium2 as pdfium

# PDFium is not thread safe. All rendering, including OCR, uses this lock.
_pdf_lock = RLock()
LEGACY_FONT = re.compile(r"^(?:FM|DL|4u|Amalee|Bamini|Kaputa|Tipitaka)", re.I)


def has_legacy_sinhala_font(page) -> bool:
    resources = page.get("/Resources", {})
    fonts = resources.get("/Font", {})
    return any(LEGACY_FONT.match(str(font.get_object().get("/BaseFont", "")).split("+")[-1].lstrip("/")) for font in fonts.values())


def render_page(path: Path, number: int) -> bytes:
    with _pdf_lock:
        document = pdfium.PdfDocument(path)
        try:
            if not 1 <= number <= len(document):
                raise IndexError("PDF page out of range")
            page = document[number - 1]
            try:
                width, height = page.get_size()
                bitmap = page.render(scale=min(2.5, 3600 / max(width, height)))
                try:
                    output = io.BytesIO()
                    bitmap.to_pil().save(output, format="PNG")
                    return output.getvalue()
                finally:
                    bitmap.close()
            finally:
                page.close()
        finally:
            document.close()
