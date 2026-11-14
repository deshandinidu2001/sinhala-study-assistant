"""Assign all legacy material to a persistent default workspace without moving files."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0004_workspaces"
down_revision = "0003_chat_metadata"
branch_labels = depends_on = None
DEFAULT = "00000000-0000-0000-0000-000000000001"

def upgrade():
    op.create_table("workspaces", sa.Column("id", UUID(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False), sa.Column("description", sa.String(500), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.execute(f"INSERT INTO workspaces (id, name, description) VALUES ('{DEFAULT}', 'My study workspace', 'Your existing notes and study outputs')")
    for table in ("documents", "chats", "quizzes"):
        op.add_column(table, sa.Column("workspace_id", UUID(), nullable=False, server_default=sa.text(f"'{DEFAULT}'::uuid")))
        op.create_foreign_key(f"fk_{table}_workspace", table, "workspaces", ["workspace_id"], ["id"], ondelete="RESTRICT")
        op.create_index(f"ix_{table}_workspace_id", table, ["workspace_id"])
    op.add_column("quizzes", sa.Column("result", JSONB(), nullable=True))

def downgrade():
    op.drop_column("quizzes", "result")
    for table in ("quizzes", "chats", "documents"):
        op.drop_index(f"ix_{table}_workspace_id", table_name=table)
        op.drop_constraint(f"fk_{table}_workspace", table, type_="foreignkey")
        op.drop_column(table, "workspace_id")
    op.drop_table("workspaces")
