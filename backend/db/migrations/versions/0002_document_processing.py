"""Track document ingestion results and actionable errors.

Revision ID: 0002_document_processing
Revises: 0001_foundation
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_document_processing"
down_revision = "0001_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("file_size", sa.Integer(), server_default="0", nullable=False))
    op.add_column("documents", sa.Column("error", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("extraction_method", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "extraction_method")
    op.drop_column("documents", "error")
    op.drop_column("documents", "file_size")
