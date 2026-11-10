"""Local document extraction, lexical retrieval, and source-based practice.

No external model or API is required. Hash vectors are a local lexical index,
not BGE-M3 semantic embeddings. Answers quote the actual source text.
"""
import hashlib
import io
import json
import logging
import math
import random
import re
import subprocess
import unicodedata
import warnings
import zipfile
from collections import Counter
from pathlib import Path
from uuid import UUID

from PIL import Image, ImageOps
from pypdf import PdfReader
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.pdf_pages import has_legacy_sinhala_font, render_page
from backend.config import get_settings
from backend.db.models import Chunk, Document
from backend.db.session import get_engine

logger = logging.getLogger(__name__)
EXTENSIONS = {".pdf", ".txt", ".md", ".docx", ".png", ".jpg", ".jpeg", ".webp"}
MAX_PAGES = 150
MAX_CHARACTERS = 1_000_000
Image.MAX_IMAGE_PIXELS = 25_000_000
STOP_WORDS = set("what is are the a an of in to and how why explain please about does do for with යනු කුමක්ද කුමක් මොකක්ද කියන්නේ කුමන මොනවාද මොනවද පැහැදිලි කරන්න ගැන පිළිබඳ කියන්න දෙන්න සහ හා ද වේ ය ඒ මේ එය ලියන්න කෙසේද ඇයි වන්නේ".split())


class StudyError(ValueError):
    pass


def normalize(value: str) -> str:
    # Preserve Sinhala conjunct ZWJ only when preceded by the virama.
    value = unicodedata.normalize("NFC", value).replace("\x00", "").replace("\u200b", "").replace("\ufeff", "")
    value = re.sub(r"(?<!\u0dca)\u200d", "", value).replace("\u200c", "")
    return re.sub(r"[ \t]+", " ", value).strip()


def words(value: str) -> list[str]:
    clean = "".join(c if unicodedata.category(c)[0] in "LMN" or c == "\u200d" else " " for c in normalize(value).casefold())
    return [word for word in clean.split() if len(word) > 1 and word not in STOP_WORDS]


def vector(value: str) -> list[float]:
    result = [0.0] * 1024
    for word, count in Counter(w.replace("\u200d", "") for w in words(value)).items():
        features = [word] + [word[i:i + 3] for i in range(max(0, len(word) - 2))]
        for feature in features:
            digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=4).digest()
            result[int.from_bytes(digest, "little") % 1024] += math.log1p(count)
    length = math.sqrt(sum(x * x for x in result)) or 1
    return [x / length for x in result]


def document_folder(document_id: UUID) -> Path:
    return get_settings().storage_path / str(document_id)


def source_path(document: Document) -> Path:
    return document_folder(document.id) / ("original" + Path(document.filename).suffix.lower())


def ocr(image: Image.Image) -> str:
    image = ImageOps.exif_transpose(image).convert("RGB")
    image.thumbnail((3600, 3600))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    try:
        completed = subprocess.run(
            ["tesseract", "stdin", "stdout", "-l", "sin+eng", "--psm", "3"],
            input=buffer.getvalue(), capture_output=True, timeout=90, check=True,
        )
    except (FileNotFoundError, subprocess.SubprocessError) as error:
        raise StudyError("රූපයේ අකුරු කියවීමට නොහැකි විය. පැහැදිලි රූපයක් හෝ අකුරු සහිත PDF ලේඛනයක් භාවිත කරන්න.") from error
    return normalize(completed.stdout.decode("utf-8", errors="replace"))


def extract_pages(path: Path) -> tuple[list[dict], str]:
    extension = path.suffix.lower()
    method = "text"
    pages: list[dict] = []
    if extension == ".pdf":
        reader = PdfReader(path)
        if reader.is_encrypted and not reader.decrypt(""):
            raise StudyError("මෙම PDF ලේඛනය මුරපදයකින් ආරක්ෂිතයි. මුරපදය ඉවත් කර නැවත එක් කරන්න.")
        if not 0 < len(reader.pages) <= MAX_PAGES:
            raise StudyError(f"වරකට පිටු {MAX_PAGES} දක්වා ඇති PDF ලේඛනයක් එක් කරන්න.")
        total = 0
        for number, page in enumerate(reader.pages, 1):
            text = normalize(page.extract_text() or "")
            used_ocr = False
            # Legacy Sinhala fonts may have a ToUnicode map that still returns Latin.
            if len(words(text)) < 4 or text.count("\ufffd") > 3 or has_legacy_sinhala_font(page):
                with Image.open(io.BytesIO(render_page(path, number))) as image:
                    text = ocr(image)
                used_ocr = True
                method = "text+ocr"
            total += len(text)
            if total > MAX_CHARACTERS:
                raise StudyError("ලේඛනයේ අකුරු ප්‍රමාණය වැඩියි. කුඩා කොටස්වලට බෙදා එක් කරන්න.")
            pages.append({"page": number, "text": text, "ocr": used_ocr})
    elif extension in {".txt", ".md"}:
        try:
            raw = path.read_bytes()
            text = raw.decode("utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig")
        except UnicodeError as error:
            raise StudyError("මෙම ලිපිය UTF-8 හෝ UTF-16 ලෙස සුරැකීමෙන් පසු නැවත එක් කරන්න.") from error
        # Form feeds preserve explicit page boundaries; otherwise use labelled sections.
        sections = text.split("\f") if "\f" in text else [text[i:i + 5000] for i in range(0, len(text), 5000)]
        pages = [{"page": i + 1, "text": normalize(part), "ocr": False} for i, part in enumerate(sections)]
    elif extension == ".docx":
        from docx import Document as WordDocument
        with zipfile.ZipFile(path) as archive:
            if sum(entry.file_size for entry in archive.infolist()) > 50_000_000:
                raise StudyError("මෙම Word ලේඛනය ඉතා විශාලයි. කුඩා කොටස්වලට බෙදන්න.")
        document = WordDocument(path)
        text = "\n".join([p.text for p in document.paragraphs] + [" | ".join(cell.text for cell in row.cells) for table in document.tables for row in table.rows])
        pages = [{"page": i // 5000 + 1, "text": normalize(text[i:i + 5000]), "ocr": False} for i in range(0, len(text), 5000)]
        method = "sections"
    elif extension in {".png", ".jpg", ".jpeg", ".webp"}:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(path) as image:
                pages = [{"page": 1, "text": ocr(image), "ocr": True}]
        method = "ocr"
    else:
        raise StudyError("PDF, TXT, MD, DOCX හෝ රූපයක් එක් කරන්න.")
    if len(pages) > MAX_PAGES or sum(len(p["text"]) for p in pages) > MAX_CHARACTERS:
        raise StudyError("ලේඛනය ඉතා විශාලයි. කුඩා කොටස්වලට බෙදා එක් කරන්න.")
    if not any(len(words(p["text"])) >= 3 for p in pages):
        raise StudyError("කියවිය හැකි අකුරු හමු නොවීය. පැහැදිලි ලේඛනයක් හෝ සටහනක අකුරු එක් කරන්න.")
    return pages, method


def chunks(text: str, maximum: int = 1400) -> list[str]:
    # Keep source pages separate, and prefer whole sentences with one-sentence overlap.
    sentences = re.split(r"(?<=[.!?।])\s+|\n+", text)
    result: list[str] = []
    current = ""
    for sentence in sentences:
        for offset in range(0, len(sentence), maximum):
            piece = sentence[offset:offset + maximum].strip()
            if not piece:
                continue
            if len(current) + len(piece) > maximum and current:
                result.append(current)
                tail = re.split(r"(?<=[.!?।])\s+", current)[-1]
                current = tail if len(tail) < 300 else ""
            current = (current + " " + piece).strip()
    if current:
        result.append(current)
    return result


def ingest(document_id: UUID) -> None:
    try:
        with Session(get_engine()) as db:
            document = db.get(Document, document_id)
            if document is None or document.status not in {"pending", "processing"}:
                return
            document.status = "processing"
            document.error = None
            path = source_path(document)
            db.commit()
        pages, method = extract_pages(path)
        with Session(get_engine()) as db:
            document = db.scalar(select(Document).where(Document.id == document_id).with_for_update())
            if document is None:
                return
            db.execute(delete(Chunk).where(Chunk.document_id == document_id))
            for page in pages:
                for index, content in enumerate(chunks(page["text"])):
                    if not words(content):
                        continue
                    db.add(Chunk(document_id=document_id, page=page["page"], chunk_index=index, text=content, embedding=vector(content), token_count=max(1, len(content.split()))))
            folder = document_folder(document_id)
            temporary = folder / "pages.tmp"
            temporary.write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
            temporary.replace(folder / "pages.json")
            document.page_count = len(pages)
            document.extraction_method = method
            document.status = "ready"
            db.commit()
    except Exception as error:
        message = str(error) if isinstance(error, StudyError) else "ලේඛනය කියවීමට නොහැකි විය. ගොනුව නිවැරදිදැයි බලා නැවත උත්සාහ කරන්න."
        logger.warning("Document ingestion failed: %s (%s)", document_id, type(error).__name__)
        with Session(get_engine()) as db:
            document = db.get(Document, document_id)
            if document is not None:
                document.status = "failed"
                document.error = message
                db.commit()


def matching_term(word: str) -> str:
    word = word.replace("\u200d", "")
    # Common textbook wording and OCR variants; these are intent synonyms,
    # not extra answer content.
    if word.startswith(("කාර්ය", "කෘත්")):
        return "කාර්ය"
    if word.startswith(("රුධිර", "රැධිර")):
        return "රුධිර"
    return word


def matches(query: str, term: str) -> bool:
    return query == term or (min(len(query), len(term)) >= 4 and (query.startswith(term) or term.startswith(query)))


def relevance(question: str, passage: str) -> float:
    query = {matching_term(word) for word in words(question)}
    terms = {matching_term(word) for word in words(passage)}
    if not query or not terms:
        return 0
    return sum(any(matches(q, term) for term in terms) for q in query) / len(query)


def source_excerpt(question: str, text: str) -> str:
    # OCR can collapse an entire page into one long sentence. Score overlapping
    # word windows so a function list late on the page is not cut off by [:1100].
    tokens = text.split()
    if len(text) <= 1100:
        return text
    terms = {matching_term(word) for word in words(question)}
    if "කාර්ය" in terms:
        headings = [index for index, token in enumerate(tokens) if matching_term(token.strip(".,:;-")) == "කාර්ය"]
        if headings:
            index = max(headings, key=lambda position: relevance(question, " ".join(tokens[max(0, position - 2):position + 1])))
            heading = " ".join(tokens[max(0, index - 2):index + 1])
            if relevance(question, heading) >= 0.65:
                return " ".join(tokens[max(0, index - 2):index + 100])[:1100]
    windows = []
    for start in range(0, len(tokens), 15):
        content = " ".join(tokens[start:start + 100])
        if content:
            windows.append(content[:1100])
    terms = {matching_term(word) for word in words(question)}
    def score(content):
        passage = [matching_term(word) for word in words(content)]
        coverage = relevance(question, content)
        density = sum(sum(matches(q, term) for term in passage) ** 0.5 for q in terms) / max(1, len(passage)) ** 0.5
        return coverage, density
    return max(windows, key=score)


def retrieve(db: Session, question: str, subject: str | None = None, document_id: UUID | None = None) -> list[dict]:
    query = select(Chunk, Document).join(Document).where(Document.status == "ready")
    if subject:
        query = query.where(Document.subject == subject)
    if document_id:
        query = query.where(Document.id == document_id)
    candidates = db.execute(query.order_by(Chunk.embedding.cosine_distance(vector(question))).limit(80)).all()
    def rank(row):
        excerpt = source_excerpt(question, row[0].text)
        terms = {matching_term(word) for word in words(question)}
        passage = [matching_term(word) for word in words(excerpt)]
        density = sum(sum(matches(q, term) for term in passage) ** 0.5 for q in terms) / max(1, len(passage)) ** 0.5
        return relevance(question, excerpt), density
    ranked = sorted(candidates, key=rank, reverse=True)
    sources = []
    seen = set()
    minimum = 0.95 if "කාර්ය" in {matching_term(word) for word in words(question)} else 0.3
    for chunk, document in ranked:
        score = relevance(question, source_excerpt(question, chunk.text))
        if score < minimum or (document.id, chunk.page) in seen:
            continue
        seen.add((document.id, chunk.page))
        excerpt = source_excerpt(question, chunk.text)
        sources.append({"document_id": str(document.id), "title": document.title, "filename": document.filename, "page": chunk.page, "excerpt": excerpt, "ocr": document.extraction_method in {"ocr", "text+ocr"}, "section": document.extraction_method == "sections" or Path(document.filename).suffix.lower() in {".txt", ".md"}})
        if len(sources) == 3:
            break
    return sources


def make_quiz(db: Session, subject: str | None, document_id: UUID | None, count: int = 5) -> list[dict]:
    query = select(Chunk, Document).join(Document).where(Document.status == "ready")
    if subject:
        query = query.where(Document.subject == subject)
    if document_id:
        query = query.where(Document.id == document_id)
    rows = db.execute(query.limit(1000)).all()
    rng = random.SystemRandom()
    candidates = []
    vocabulary = set()
    for chunk, document in rows:
        vocabulary.update(w for w in words(chunk.text) if len(w) >= 4)
        for sentence in re.split(r"(?<=[.!?।])\s+|\n+", chunk.text):
            if 30 <= len(sentence) <= 500 and len(words(sentence)) >= 5:
                candidates.append((sentence, chunk, document))
    rng.shuffle(candidates)
    result = []
    seen = set()
    for sentence, chunk, document in candidates:
        if sentence in seen:
            continue
        choices = [w for w in words(sentence) if len(w) >= 4 and w in sentence.casefold()]
        if not choices:
            continue
        answer = rng.choice(choices)
        distractors = sorted(w for w in vocabulary if w != answer and w not in sentence.casefold())
        if len(distractors) < 3:
            continue
        options = [answer] + rng.sample(distractors, 3)
        rng.shuffle(options)
        prompt = re.sub(re.escape(answer), "________", sentence, count=1, flags=re.IGNORECASE)
        result.append({"prompt": "හිස්තැනට සුදුසු වචනය තෝරන්න.\n" + prompt, "options": options, "answer_index": options.index(answer), "explanation": sentence, "source": {"document_id": str(document.id), "title": document.title, "page": chunk.page, "section": document.extraction_method == "sections" or Path(document.filename).suffix.lower() in {".txt", ".md"}}})
        seen.add(sentence)
        if len(result) == count:
            break
    if not result:
        raise StudyError("ප්‍රශ්න සෑදීමට ප්‍රමාණවත් සම්පූර්ණ වාක්‍ය නැත. වඩා දිගු පාඩම් සටහනක් එක් කරන්න.")
    return result
