"""Full API lifecycle in a disposable migrated database and temporary storage."""
import os
import shutil
import time
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from PIL import Image, ImageDraw, ImageFont
from docx import Document as WordDocument

from backend.config import get_settings
from backend.db.session import get_engine
from backend.db.models import Chunk, Document
from backend.main import create_app
from backend.study import source_path
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend.tests.test_study import write_pdf

pytestmark = pytest.mark.integration
NOTE = """ප්‍රභාසංස්ලේෂණය යනු හරිත ශාක සූර්යාලෝකය භාවිතයෙන් ආහාර නිපදවන ක්‍රියාවලියයි.
ශාක පත්‍රවල ඇති හරිතප්‍රද මගින් සූර්යාලෝක ශක්තිය අවශෝෂණය කරයි.
ප්‍රභාසංස්ලේෂණයේදී කාබන් ඩයොක්සයිඩ් සහ ජලය යොදා ග්ලූකෝස් නිපදවයි.
මෙම ක්‍රියාවලියේදී ඔක්සිජන් වායුව අතුරු ඵලයක් ලෙස පරිසරයට මුදාහරියි.
පත්‍රවල පූටිකා මගින් ශාකයට අවශ්‍ය වායු හුවමාරුව සිදු කරයි.
ශාකයේ මූල පද්ධතිය මගින් පසෙන් ජලය සහ ඛනිජ ලවණ අවශෝෂණය කරයි.
"""


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to run live workflows")
    parent = create_engine(url, isolation_level="AUTOCOMMIT")
    name = "study_workflow_" + uuid4().hex
    with parent.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    test_url = parent.url.set(database=name).render_as_string(hide_password=False)
    monkeypatch.setenv("DATABASE_URL", test_url)
    monkeypatch.setenv("STORAGE_PATH", str(tmp_path))
    monkeypatch.setenv("APP_ENV", "test")
    get_engine.cache_clear()
    get_settings.cache_clear()
    try:
        command.upgrade(Config(str(Path(__file__).resolve().parents[1] / "alembic.ini")), "head")
        with TestClient(create_app()) as test_client:
            yield test_client
    finally:
        get_engine().dispose()
        get_engine.cache_clear()
        get_settings.cache_clear()
        with parent.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        parent.dispose()


def wait_document(client: TestClient, document_id: str) -> dict:
    for _ in range(100):
        document = client.get(f"/documents/{document_id}").json()
        if document["status"] in {"ready", "failed"}:
            return document
        time.sleep(0.1)
    pytest.fail("Document processing did not finish")


def test_sinhala_upload_answer_citation_quiz_history_and_delete(client: TestClient) -> None:
    response = client.post("/documents", files={"file": ("notes.txt", NOTE.encode(), "text/plain")}, data={"title": "ප්‍රභාසංස්ලේෂණය", "subject": "විද්‍යාව"})
    assert response.status_code == 202, response.text
    document_id = response.json()["id"]
    document = wait_document(client, document_id)
    assert document["status"] == "ready", document
    assert "හරිතප්‍රද" in document["pages"][0]["text"]
    assert client.get(f"/documents/{document_id}/file").content == NOTE.encode()
    assert len(client.get("/documents").json()) == 1
    chat = client.post("/chat", json={"question": "ප්‍රභාසංස්ලේෂණය යනු කුමක්ද?", "document_id": document_id}).json()
    assert chat["mode"] == "extractive"
    assert "ආහාර" in chat["answer"]
    assert chat["sources"][0]["document_id"] == document_id
    assert chat["sources"][0]["page"] == 1
    assert client.get("/chats").json()[0]["id"] == chat["id"]
    for filters in [{}, {"subject": "ඉතිහාසය"}]:
        no_match = client.post("/chat", json={"question": "ගිනිකඳු යනු කුමක්ද?", **filters}).json()
        assert no_match["mode"] == "no_match" and no_match["sources"] == []
    quiz_response = client.post("/quizzes", json={"document_id": document_id, "count": 5})
    assert quiz_response.status_code == 201, quiz_response.text
    quiz = quiz_response.json()
    assert len(quiz["questions"]) == 5
    assert all("answer_index" not in question for question in quiz["questions"])
    invalid = client.post(f"/quizzes/{quiz['id']}/submit", json={"answers": [99] * 5})
    assert invalid.status_code == 422
    result = client.post(f"/quizzes/{quiz['id']}/submit", json={"answers": [0] * 5}).json()
    assert result["total"] == 5
    assert result["score"] == sum(q["answer_index"] == 0 for q in result["questions"])
    correct = client.post(f"/quizzes/{quiz['id']}/submit", json={"answers": [q["answer_index"] for q in result["questions"]]}).json()
    assert correct["score"] == 5
    assert client.delete(f"/documents/{document_id}").status_code == 204
    assert client.get(f"/documents/{document_id}").status_code == 404
    assert client.get("/documents").json() == []
    assert client.post("/chat", json={"question": "ප්‍රභාසංස්ලේෂණය"}).json()["sources"] == []


def test_pdf_upload_has_page_two_citation(client: TestClient, tmp_path: Path) -> None:
    path = tmp_path / "notes.pdf"
    write_pdf(path)
    response = client.post("/documents", files={"file": ("notes.pdf", path.read_bytes(), "application/pdf")})
    assert response.status_code == 202
    document = wait_document(client, response.json()["id"])
    assert document["status"] == "ready"
    assert document["page_count"] == 2
    chat = client.post("/chat", json={"question": "What is chlorophyll?"}).json()
    assert chat["sources"][0]["page"] == 2


def test_bad_files_validation_and_retry(client: TestClient) -> None:
    assert client.post("/documents", files={"file": ("notes.exe", b"abc")}).status_code == 415
    assert client.post("/documents", files={"file": ("empty.txt", b"")}).status_code == 400
    assert client.post("/documents", files={"file": ("big.txt", b"a" * (25 * 1024 * 1024 + 1))}).status_code == 413
    assert client.post("/chat", json={"question": "  "}).status_code == 422
    assert client.post("/documents/text", json={"title": "  ", "content": NOTE}).status_code == 422
    assert client.get(f"/documents/{uuid4()}").status_code == 404
    response = client.post("/documents", files={"file": ("broken.pdf", b"This is not a PDF")})
    document_id = response.json()["id"]
    document = wait_document(client, document_id)
    assert document["status"] == "failed"
    assert document["error"]
    assert client.post(f"/documents/{document_id}/retry").status_code == 202
    assert wait_document(client, document_id)["status"] == "failed"


def test_pasted_notes_persist_and_insufficient_quiz_is_actionable(client: TestClient) -> None:
    response = client.post("/documents/text", json={"title": "කෙටි සටහන", "content": "මෙය ශාක පිළිබඳ ඉතා කෙටි අධ්‍යයන සටහනකි."})
    assert response.status_code == 202
    assert wait_document(client, response.json()["id"])["status"] == "ready"
    result = client.post("/quizzes", json={})
    assert result.status_code == 422
    assert "detail" in result.json()


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="Real OCR requires the Docker image's Tesseract installation")
@pytest.mark.parametrize("extension", ["png", "jpg", "webp", "pdf"])
def test_real_image_and_scanned_pdf_ocr(client: TestClient, tmp_path: Path, extension: str) -> None:
    image = Image.new("RGB", (1700, 500), "white")
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
    draw = ImageDraw.Draw(image)
    draw.text((60, 60), "Photosynthesis uses sunlight to produce glucose.", font=font, fill="black")
    draw.text((60, 140), "Chlorophyll absorbs light energy inside green leaves.", font=font, fill="black")
    path = tmp_path / f"scan.{extension}"
    image.save(path)
    response = client.post("/documents", files={"file": (path.name, path.read_bytes())})
    assert response.status_code == 202
    document = wait_document(client, response.json()["id"])
    assert document["status"] == "ready", document
    assert document["pages"][0]["ocr"] is True
    assert "Photosynthesis" in document["pages"][0]["text"]
    assert client.post("/chat", json={"question": "What is chlorophyll?"}).json()["sources"]


def test_word_upload_and_markdown_are_ready(client: TestClient, tmp_path: Path) -> None:
    word = WordDocument()
    word.add_paragraph(NOTE)
    path = tmp_path / "notes.docx"
    word.save(path)
    for filename, content in [("notes.docx", path.read_bytes()), ("notes.md", NOTE.encode())]:
        response = client.post("/documents", files={"file": (filename, content)})
        assert response.status_code == 202
        document = wait_document(client, response.json()["id"])
        assert document["status"] == "ready"
        assert "හරිතප්‍රද" in document["pages"][0]["text"]


@pytest.mark.parametrize("interrupted_status", ["pending", "processing"])
def test_restart_resumes_interrupted_documents(client: TestClient, monkeypatch: pytest.MonkeyPatch, interrupted_status: str) -> None:
    with Session(get_engine()) as db:
        document = Document(id=uuid4(), title="නැවත ආරම්භ කළ සටහන", filename="restart.txt", subject="විද්‍යාව", status=interrupted_status)
        path = source_path(document)
        path.parent.mkdir(parents=True)
        path.write_text(NOTE, encoding="utf-8")
        db.add(document)
        db.commit()
        document_id = str(document.id)
    monkeypatch.setenv("APP_ENV", "development")
    get_settings.cache_clear()
    with TestClient(create_app()) as restarted:
        recovered = wait_document(restarted, document_id)
        assert recovered["status"] == "ready"
        assert recovered["pages"][0]["text"].startswith("ප්‍රභාසංස්ලේෂණය")
    get_settings.cache_clear()


def test_singlish_interpretation_retrieval_and_history(client: TestClient) -> None:
    note = client.post("/documents/text", json={"title": "පටක", "content": "ජීව පටක යනු සමාන කෘත්‍යයක් ඉටු කරන සෛල සමූහයකි."}).json()
    assert wait_document(client, note["id"])["status"] == "ready"
    question = "MKD JIWA PATAKA KIYANNE"
    preview = client.post("/questions/normalize", json={"question": question}).json()
    assert "ජීව පටක" in preview["question"]
    response = client.post("/chat", json={"question": question, "document_id": note["id"]})
    assert response.status_code == 201, response.text
    chat = response.json()
    assert chat["mode"] == "extractive"
    assert chat["question"] == question
    assert "ජීව පටක" in chat["normalized_question"]
    assert chat["sources"][0]["document_id"] == note["id"]
    assert client.get("/chats").json()[-1]["normalized_question"] == chat["normalized_question"]
