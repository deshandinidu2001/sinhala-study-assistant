"""Persistent API for the library, cited questions, and scored practice."""
import json
import logging
import shutil
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path as ApiPath, Request, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend import gemini
from backend import audio_reviews
from backend.kimi import KIMI_UNAVAILABLE
from backend.summaries import make_summary, cached_summary, SUMMARY_NO_KEY, SUMMARY_UNAVAILABLE, SummaryOptions
from backend.quizzes import make_mcq_quiz, NO_KEY, UNAVAILABLE
from backend.pdf_pages import render_page
from backend.config import get_settings
from backend.db.models import Chat, Chunk, Document, Quiz
from backend.db.session import get_db
from backend.study import EXTENSIONS, StudyError, document_folder, ingest, normalize, retrieve, source_path, words

router = APIRouter()
DB = Annotated[Session, Depends(get_db)]


def document_data(document: Document) -> dict:
    return {"id": str(document.id), "title": document.title, "subject": document.subject,
            "filename": document.filename, "page_count": document.page_count,
            "status": document.status, "file_size": document.file_size, "error": document.error,
            "extraction_method": document.extraction_method, "uploaded_at": document.uploaded_at.isoformat()}


def require_document(db: Session, document_id: UUID) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(404, "ලේඛනය හමු නොවීය. ලේඛන එකතුව නැවත පූරණය කරන්න.")
    return document


@router.get("/documents")
def list_documents(db: DB) -> list[dict]:
    return [document_data(d) for d in db.scalars(select(Document).order_by(Document.uploaded_at.desc())).all()]


def save_document(db: Session, request: Request, filename: str, content: bytes, title: str, subject: str) -> dict:
    # Never use a client-provided filename as a filesystem path.
    filename = filename.replace("\\", "/").rsplit("/", 1)[-1][:255]
    extension = Path(filename).suffix.lower()
    if extension not in EXTENSIONS:
        raise HTTPException(415, "PDF, TXT, MD, DOCX, PNG, JPG හෝ WEBP ගොනුවක් එක් කරන්න.")
    if not content:
        raise HTTPException(400, "ගොනුව හිස්ය. අන්තර්ගතයක් ඇති ගොනුවක් තෝරන්න.")
    if len(content) > get_settings().max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"ගොනුව {get_settings().max_upload_mb} MB ට වඩා කුඩා විය යුතුය.")
    title = normalize(title) or Path(filename).stem
    subject = normalize(subject) or "සාමාන්‍ය"
    if len(title) > 255 or len(subject) > 120:
        raise HTTPException(422, "ලේඛන නම අකුරු 255 සහ විෂය අකුරු 120 නොඉක්මවිය යුතුය.")
    document = Document(id=uuid4(), title=title, subject=subject, filename=filename, file_size=len(content), status="pending")
    folder = document_folder(document.id)
    folder.mkdir(parents=True, exist_ok=False)
    try:
        source_path(document).write_bytes(content)
        db.add(document)
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        shutil.rmtree(folder, ignore_errors=True)
        raise
    request.app.state.ingestion.submit(ingest, document.id)
    return document_data(document)


@router.post("/documents", status_code=202)
def upload_document(request: Request, db: DB, file: Annotated[UploadFile, File()], title: Annotated[str, Form()] = "", subject: Annotated[str, Form()] = "") -> dict:
    limit = get_settings().max_upload_mb * 1024 * 1024
    try:
        content = file.file.read(limit + 1)
        return save_document(db, request, file.filename or "file", content, title, subject)
    finally:
        file.file.close()


class NoteInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    subject: str = Field(default="සාමාන්‍ය", max_length=120)
    content: str = Field(min_length=20, max_length=200_000)


@router.post("/documents/text", status_code=202)
def add_note(body: NoteInput, request: Request, db: DB) -> dict:
    if len(normalize(body.content)) < 20 or not normalize(body.title):
        raise HTTPException(422, "සටහනට නමක් සහ අවම අකුරු 20ක අන්තර්ගතයක් එක් කරන්න.")
    return save_document(db, request, "note.txt", body.content.encode("utf-8"), body.title, body.subject)


@router.get("/documents/{document_id}")
def get_document(document_id: UUID, db: DB) -> dict:
    document = require_document(db, document_id)
    pages = []
    if document.status == "ready":
        try:
            pages = json.loads((document_folder(document_id) / "pages.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raise HTTPException(409, "ලේඛනයේ අකුරු ලබාගත නොහැක. ලේඛනය නැවත එක් කරන්න.")
    return {**document_data(document), "pages": pages}


@router.get("/documents/{document_id}/file")
def get_original(document_id: UUID, db: DB) -> FileResponse:
    document = require_document(db, document_id)
    path = source_path(document)
    if not path.is_file():
        raise HTTPException(404, "මුල් ගොනුව හමු නොවීය. ලේඛනය නැවත එක් කරන්න.")
    return FileResponse(path, filename=document.filename, content_disposition_type="inline", headers={"X-Content-Type-Options": "nosniff"})


@router.get("/documents/{document_id}/pages/{number}/image")
def get_page_image(document_id: UUID, number: int, db: DB) -> Response:
    document = require_document(db, document_id)
    if Path(document.filename).suffix.lower() != ".pdf":
        raise HTTPException(415, "මෙම ලේඛනය PDF ගොනුවක් නොවේ.")
    if not source_path(document).is_file():
        raise HTTPException(404, "මුල් ගොනුව හමු නොවීය.")
    try:
        content = render_page(source_path(document), number)
    except IndexError:
        raise HTTPException(404, "පිටුව හමු නොවීය.")
    except Exception:
        raise HTTPException(422, "PDF පිටුව පෙන්විය නොහැක. මුල් ගොනුව විවෘත කරන්න.")
    return Response(content, media_type="image/png", headers={"Cache-Control": "private, max-age=3600"})


@router.post("/documents/{document_id}/reprocess", status_code=202)
def reprocess_document(document_id: UUID, request: Request, db: DB) -> dict:
    document = db.scalar(select(Document).where(Document.id == document_id).with_for_update())
    if document is None:
        raise HTTPException(404, "ලේඛනය හමු නොවීය.")
    if document.status not in {"ready", "failed"}:
        raise HTTPException(409, "ලේඛනය දැනටමත් සකසමින් පවතී.")
    document.status = "pending"
    document.error = None
    db.commit()
    request.app.state.ingestion.submit(ingest, document.id)
    return document_data(document)


@router.post("/documents/{document_id}/retry", status_code=202)
def retry_document(document_id: UUID, request: Request, db: DB) -> dict:
    document = db.scalar(select(Document).where(Document.id == document_id).with_for_update())
    if document is None:
        raise HTTPException(404, "ලේඛනය හමු නොවීය.")
    if document.status != "failed":
        raise HTTPException(409, "නැවත උත්සාහ කළ හැක්කේ අසාර්ථක ලේඛනයකට පමණයි.")
    document.status = "pending"
    document.error = None
    db.commit()
    request.app.state.ingestion.submit(ingest, document.id)
    return document_data(document)


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: UUID, db: DB) -> None:
    document = db.scalar(select(Document).where(Document.id == document_id).with_for_update())
    if document is None:
        raise HTTPException(404, "ලේඛනය හමු නොවීය.")
    db.delete(document)
    db.commit()
    shutil.rmtree(document_folder(document_id), ignore_errors=True)


class QuestionInput(BaseModel):
    answer_language: Literal["si", "en"] = "si"
    language: Literal["auto", "singlish", "original"] = "auto"
    question: str = Field(min_length=2, max_length=2000)
    subject: str | None = Field(default=None, max_length=120)
    document_id: UUID | None = None

    @field_validator("question")
    @classmethod
    def trim_question(cls, value: str) -> str:
        value = normalize(value)
        if len(value) < 2:
            raise ValueError("ප්‍රශ්නයක් ලියන්න.")
        return value


def chat_data(chat: Chat) -> dict:
    return {"id": str(chat.id), "question": chat.question, "answer": chat.answer,
            "sources": chat.sources, "subject": chat.subject,
            "mode": (chat.details or {}).get("mode", "extractive" if chat.sources else "no_match"),
            "document_id": (chat.details or {}).get("document_id"),
            "normalized_question": (chat.details or {}).get("normalized_question", chat.question),
            "normalization": (chat.details or {}).get("normalization", "original"),
            "notice": (chat.details or {}).get("notice"), "created_at": chat.created_at.isoformat()}


def question_vocabulary(db: Session, body: QuestionInput) -> set[str]:
    query = select(Chunk.text).join(Document).where(Document.status == "ready")
    if body.document_id:
        query = query.where(Document.id == body.document_id)
    if body.subject:
        query = query.where(Document.subject == body.subject)
    vocabulary = set()
    for content in db.scalars(query.order_by(Chunk.document_id, Chunk.page, Chunk.chunk_index).limit(500)):
        vocabulary.update(words(content))
        if len(vocabulary) >= 10000:
            break
    return vocabulary


@router.get("/capabilities")
def capabilities() -> dict:
    return {"gemini_configured": gemini.configured(), "singlish": True}


@router.post("/questions/normalize")
def interpret_question(body: QuestionInput, db: DB) -> dict:
    question, method, notice = gemini.interpret(body.question, body.language, question_vocabulary(db, body))
    return {"question": question, "method": method, "notice": notice}


@router.get("/chats")
def list_chats(db: DB) -> list[dict]:
    rows = db.scalars(select(Chat).order_by(Chat.created_at.desc()).limit(50)).all()
    return [chat_data(row) for row in reversed(rows)]


@router.post("/chat", status_code=201)
def ask_question(body: QuestionInput, db: DB) -> dict:
    if body.document_id:
        require_document(db, body.document_id)
    question, normalization, notice = gemini.interpret(body.question, body.language, question_vocabulary(db, body))
    sources = retrieve(db, question, body.subject, body.document_id)
    if sources:
        answer = ("Relevant passages from your sources:\n\n" if body.answer_language == "en" else "ඔබේ ලේඛනවලින් හමු වූ අදාළ කොටස්:\n\n") + "\n\n".join(f"{source['excerpt']} [{i}]" for i, source in enumerate(sources, 1))
    else:
        answer = "ඔබේ ලේඛනවල මෙම ප්‍රශ්නයට අදාළ තොරතුරු හමු නොවීය. අදාළ පාඩම එක් කරන්න හෝ ලේඛනයේ ඇති ප්‍රධාන වචන භාවිත කර ප්‍රශ්නය නැවත අසන්න."
    if not sources and body.answer_language == "en":
        answer = "No matching passages. Try a key term from your notes or choose another source."
    mode = "extractive" if sources else "no_match"
    if sources and gemini.configured():
        try:
            explanation = gemini.explain(question, sources, body.answer_language)
            if explanation:
                answer, mode = explanation, "gemini"
            else:
                notice = "Gemini පිළිතුර මූලාශ්‍රවලින් තහවුරු කළ නොහැකි නිසා අදාළ කොටස් උපුටා පෙන්වයි."
        except gemini.GeminiUnavailable:
            notice = gemini.FALLBACK_NOTICE
    chat = Chat(question=body.question, answer=answer, sources=sources, subject=body.subject, details={"document_id": str(body.document_id) if body.document_id else None, "normalized_question": question, "normalization": normalization, "mode": mode, "notice": notice})
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat_data(chat)


class SummaryInput(SummaryOptions):
    language: Literal["si", "en"] = "si"
    focus: str = Field(default="", max_length=500)
    regenerate: bool = False


@router.get("/documents/{document_id}/summary")
def get_summary(document_id: UUID, db: DB, language: Literal["si", "en"] = "si", focus: str = "", length: Literal["short", "medium", "long"] = "medium", include: str = "definitions,comparisons,advantages,disadvantages,functions,examples,processes", provider: Literal["gemini", "kimi"] = "gemini") -> dict:
    document = require_document(db, document_id)
    if document.status != "ready":
        raise HTTPException(409, "ලේඛනය තවම සූදානම් නැත.")
    try:
        result = cached_summary(document, language, focus[:500], SummaryOptions(length=length, include=include.split(","), provider=provider))
    except (StudyError, ValueError) as error:
        raise HTTPException(422, str(error))
    return {"summary": result}


@router.post("/documents/{document_id}/summary")
def create_summary(document_id: UUID, body: SummaryInput, db: DB) -> dict:
    document = require_document(db, document_id)
    if document.status != "ready":
        raise HTTPException(409, "ලේඛනය තවම සූදානම් නැත.")
    try:
        return make_summary(document, body.language, body.focus.strip(), body.regenerate, SummaryOptions(length=body.length, include=body.include, provider=body.provider))
    except StudyError as error:
        raise HTTPException(422, str(error))
    except gemini.GeminiUnavailable as error:
        raise HTTPException(503, str(error) if str(error) in {SUMMARY_NO_KEY, KIMI_UNAVAILABLE} else SUMMARY_UNAVAILABLE)


def audio_summary(document_id: UUID, db: Session, body: SummaryInput) -> dict:
    document = require_document(db, document_id)
    if document.status != "ready":
        raise HTTPException(409, "ලේඛනය තවම සූදානම් නැත.")
    summary = cached_summary(document, body.language, body.focus.strip(),
        SummaryOptions(length=body.length, include=body.include, provider=body.provider))
    if not summary:
        raise HTTPException(409, "පළමුව සාරාංශයක් සකසන්න. ඉන්පසු හඬ සමාලෝචනය සාදන්න.")
    return summary


@router.get("/documents/{document_id}/audio-review")
def get_audio_review(document_id: UUID, db: DB, language: Literal["si", "en"] = "si", focus: str = "", length: Literal["short", "medium", "long"] = "medium", include: str = "definitions,comparisons,advantages,disadvantages,functions,examples,processes", provider: Literal["gemini", "kimi"] = "gemini") -> dict:
    try:
        summary = audio_summary(document_id, db, SummaryInput(language=language, focus=focus[:500], length=length, include=include.split(","), provider=provider))
        return {"audio": audio_reviews.cached_audio(document_id, summary)}
    except (StudyError, ValueError) as error:
        raise HTTPException(422, str(error))


@router.post("/documents/{document_id}/audio-review")
def create_audio_review(document_id: UUID, body: SummaryInput, db: DB) -> dict:
    try:
        return audio_reviews.make_audio(document_id, audio_summary(document_id, db, body))
    except StudyError as error:
        raise HTTPException(422, str(error))
    except audio_reviews.AudioUnavailable as error:
        raise HTTPException(503, str(error))
    except OSError:
        raise HTTPException(503, "හඬ ගොනුව සුරැකිය නොහැක. නැවත උත්සාහ කරන්න.")


@router.get("/documents/{document_id}/audio/{audio_id}")
def get_audio_file(document_id: UUID, audio_id: Annotated[str, ApiPath(pattern=r"^[a-f0-9]{64}$")], db: DB, download: bool = False) -> FileResponse:
    require_document(db, document_id)
    path = document_folder(document_id) / f"audio-{audio_id}.wav"
    if not path.is_file():
        raise HTTPException(404, "හඬ ගොනුව හමු නොවීය. හඬ සමාලෝචනය නැවත සාදන්න.")
    return FileResponse(path, media_type="audio/wav", filename=f"audio-review-{document_id}.wav" if download else None,
                        headers={"Cache-Control": "private, max-age=86400"})


class QuizInput(BaseModel):
    language: Literal["si", "en"] = "si"
    subject: str | None = Field(default=None, max_length=120)
    document_id: UUID | None = None
    count: int = Field(default=5, ge=1, le=10)


def quiz_data(quiz: Quiz) -> dict:
    # Correct answers stay on the server until the quiz is submitted.
    return {"id": str(quiz.id), "subject": quiz.subject, "kind": quiz.questions[0].get("kind", "legacy") if quiz.questions else "mcq", "grade": 11,
            "language": quiz.questions[0].get("language", "si") if quiz.questions else "si", "questions": [
        {"prompt": q["prompt"], "options": q["options"], "skill": q.get("skill", "knowledge")} for q in quiz.questions
    ]}


@router.post("/quizzes", status_code=201)
def create_quiz(body: QuizInput, db: DB) -> dict:
    if body.document_id:
        require_document(db, body.document_id)
    try:
        questions = make_mcq_quiz(db, body.subject, body.document_id, body.count, body.language)
    except StudyError as error:
        raise HTTPException(422, str(error))
    except gemini.GeminiUnavailable as error:
        raise HTTPException(503, NO_KEY if str(error) == NO_KEY else UNAVAILABLE)
    quiz = Quiz(subject=body.subject or "සියලු විෂයන්", questions=questions)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz_data(quiz)


class QuizSubmission(BaseModel):
    answers: list[int] = Field(min_length=1, max_length=10)


@router.post("/quizzes/{quiz_id}/submit")
def grade_quiz(quiz_id: UUID, body: QuizSubmission, db: DB) -> dict:
    quiz = db.get(Quiz, quiz_id)
    if quiz is None:
        raise HTTPException(404, "ප්‍රශ්න කට්ටලය හමු නොවීය. අලුත් පුහුණුවක් අරඹන්න.")
    if len(body.answers) != len(quiz.questions) or any(a < 0 or a >= len(q["options"]) for a, q in zip(body.answers, quiz.questions)):
        raise HTTPException(422, "සෑම ප්‍රශ්නයකටම වලංගු පිළිතුරක් තෝරන්න.")
    results = [{**q, "selected_index": a, "correct": a == q["answer_index"]} for a, q in zip(body.answers, quiz.questions)]
    return {"score": sum(q["correct"] for q in results), "total": len(results), "questions": results}
