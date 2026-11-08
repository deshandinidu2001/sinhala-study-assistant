import pytest
from pydantic import ValidationError

from backend.config import Settings


def test_rejects_non_postgres_database() -> None:
    with pytest.raises(ValidationError, match="DATABASE_URL must use"):
        Settings(_env_file=None, database_url="sqlite:///test.db")


def test_embedding_dimensions_are_fixed() -> None:
    with pytest.raises(ValidationError, match="embedding_dimensions"):
        Settings(_env_file=None, embedding_dimensions=768, database_url="postgresql+psycopg://localhost/test")


def test_rejects_wildcard_cors() -> None:
    with pytest.raises(ValidationError, match="Configure explicit CORS origins"):
        Settings(_env_file=None, cors_origins=["*"], database_url="postgresql+psycopg://localhost/test")


def test_api_keys_are_redacted() -> None:
    settings = Settings(
        _env_file=None, anthropic_api_key="private-key",
        database_url="postgresql+psycopg://localhost/test",
    )
    assert "private-key" not in repr(settings)


def test_numeric_environment_values_are_parsed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EMBEDDING_DIMENSIONS", "1024")
    settings = Settings(_env_file=None, database_url="postgresql+psycopg://localhost/test")
    assert settings.embedding_dimensions == 1024
