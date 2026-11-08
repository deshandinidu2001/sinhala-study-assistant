"""Initial document, vector, conversation, and quiz schema."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision: str = "0001_foundation"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(120), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("page_count >= 0", name="ck_documents_page_count"),
        sa.CheckConstraint("status IN ('pending', 'processing', 'ready', 'failed')", name="ck_documents_status"),
    )
    op.create_index("ix_documents_subject", "documents", ["subject"])
    op.create_table(
        "chunks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("document_id", sa.Uuid(), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1024), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.CheckConstraint("page > 0", name="ck_chunks_page"),
        sa.CheckConstraint("chunk_index >= 0", name="ck_chunks_index"),
        sa.CheckConstraint("token_count > 0", name="ck_chunks_token_count"),
    )
    op.create_index("ix_chunks_document_id", "chunks", ["document_id"])
    op.create_index("uq_chunks_document_page_index", "chunks", ["document_id", "page", "chunk_index"], unique=True)
    op.create_index(
        "ix_chunks_embedding_hnsw", "chunks", ["embedding"], postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
    op.create_table(
        "chats",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("sources", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("subject", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "quizzes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("subject", sa.String(120), nullable=False),
        sa.Column("questions", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("quizzes")
    op.drop_table("chats")
    op.drop_table("chunks")
    op.drop_table("documents")
    # The shared vector extension may be used by other schemas; leave it installed.
