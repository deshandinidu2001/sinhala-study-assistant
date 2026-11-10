"""Preserve question interpretation and answer provenance in history."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_chat_metadata"
down_revision = "0002_document_processing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chats", sa.Column("details", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))


def downgrade() -> None:
    op.drop_column("chats", "details")
