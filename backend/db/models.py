"""PostgreSQL schema. Schema changes are applied exclusively through Alembic."""

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint("page_count >= 0", name="ck_documents_page_count"),
        CheckConstraint(
            "status IN ('pending', 'processing', 'ready', 'failed')",
            name="ck_documents_status",
        ),
        Index("ix_documents_subject", "subject"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(120))
    filename: Mapped[str] = mapped_column(String(255))
    page_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    status: Mapped[str] = mapped_column(String(16), default="pending", server_default="pending")
    file_size: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_method: Mapped[str | None] = mapped_column(String(32), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    chunks: Mapped[list["Chunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan", passive_deletes=True
    )


class Chunk(Base):
    __tablename__ = "chunks"
    __table_args__ = (
        CheckConstraint("page > 0", name="ck_chunks_page"),
        CheckConstraint("chunk_index >= 0", name="ck_chunks_index"),
        CheckConstraint("token_count > 0", name="ck_chunks_token_count"),
        Index("ix_chunks_document_id", "document_id"),
        Index("uq_chunks_document_page_index", "document_id", "page", "chunk_index", unique=True),
        Index(
            "ix_chunks_embedding_hnsw", "embedding", postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    page: Mapped[int] = mapped_column(Integer)
    chunk_index: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(1024))
    token_count: Mapped[int] = mapped_column(Integer)
    document: Mapped[Document] = relationship(back_populates="chunks")


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    sources: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    subject: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    subject: Mapped[str] = mapped_column(String(120))
    questions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
