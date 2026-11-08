"""Non-destructive integration tests against a migrated PostgreSQL database."""

import os
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.db.models import Chunk, Document

pytestmark = pytest.mark.integration


@pytest.fixture
def engine() -> Iterator[Engine]:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to run live PostgreSQL integration tests")
    db_engine = create_engine(url, connect_args={"connect_timeout": 5})
    yield db_engine
    db_engine.dispose()


def test_schema_has_all_tables_and_required_indexes(engine: Engine) -> None:
    inspector = inspect(engine)
    assert {"documents", "chunks", "chats", "quizzes"} <= set(inspector.get_table_names())
    with engine.connect() as connection:
        indexes = dict(connection.execute(text(
            "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'"
        )).all())
        assert "USING hnsw (embedding vector_cosine_ops)" in indexes["ix_chunks_embedding_hnsw"]
        assert "USING btree (subject)" in indexes["ix_documents_subject"]
        dimension = connection.execute(text(
            "SELECT format_type(atttypid, atttypmod) FROM pg_attribute "
            "WHERE attrelid = 'chunks'::regclass AND attname = 'embedding'"
        )).scalar_one()
        assert dimension == "vector(1024)"


def test_sinhala_round_trip_cosine_search_and_cascade(engine: Engine) -> None:
    # An explicit outer rollback leaves the configured database unchanged.
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
                document = Document(title="සිංහල සටහන්", subject="භෞතික විද්‍යාව", filename="notes.pdf")
                session.add(document)
                session.flush()
                vector = [1.0] + [0.0] * 1023
                chunk = Chunk(
                    document_id=document.id, page=2, chunk_index=0,
                    text="ආලෝකය පිළිබඳ සටහනක්.", embedding=vector, token_count=15,
                )
                session.add(chunk)
                session.flush()
                result = session.query(Chunk).filter(Chunk.document_id == document.id).order_by(
                    Chunk.embedding.cosine_distance(vector)
                ).one()
                assert result.text == "ආලෝකය පිළිබඳ සටහනක්."
                assert result.page == 2
                assert document.uploaded_at.tzinfo is not None
                session.delete(document)
                session.flush()
                assert session.query(Chunk).filter_by(document_id=document.id).count() == 0
        finally:
            transaction.rollback()


def test_migrations_round_trip_in_disposable_database(
    engine: Engine, monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_name = f"study_acceptance_{uuid4().hex}"
    maintenance = create_engine(
        engine.url.set(database="postgres"), isolation_level="AUTOCOMMIT",
        connect_args={"connect_timeout": 5},
    )
    temporary = create_engine(
        engine.url.set(database=database_name), connect_args={"connect_timeout": 5},
    )
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    with maintenance.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{database_name}"'))
    try:
        monkeypatch.setenv("DATABASE_URL", temporary.url.render_as_string(hide_password=False))
        get_settings.cache_clear()
        command.upgrade(config, "head")
        command.check(config)
        assert {"documents", "chunks", "chats", "quizzes"} <= set(inspect(temporary).get_table_names())
        command.downgrade(config, "base")
        assert "documents" not in inspect(temporary).get_table_names()
        command.upgrade(config, "head")
        command.check(config)
    finally:
        temporary.dispose()
        get_settings.cache_clear()
        with maintenance.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{database_name}"'))
        maintenance.dispose()
