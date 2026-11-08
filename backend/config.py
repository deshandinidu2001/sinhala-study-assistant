"""Environment configuration shared by the API and migration runner."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: Literal["development", "test", "production"] = "development"
    database_url: str
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    storage_path: Path = PROJECT_ROOT / "storage"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    embedding_model: str = "BAAI/bge-m3"
    embedding_dimensions: int = Field(default=1024, ge=1024, le=1024)
    chunk_target_tokens: int = Field(default=400, ge=300, le=500)
    chunk_overlap_tokens: int = Field(default=50, ge=0, lt=300)
    retrieval_top_k: int = Field(default=5, ge=1, le=20)
    retrieval_similarity_threshold: float = Field(default=0.45, ge=0, le=1)
    anthropic_api_key: SecretStr = SecretStr("")
    anthropic_model: str = "claude-sonnet-4-6"
    openai_api_key: SecretStr = SecretStr("")
    whisper_model: str = "whisper-1"
    ocr_language: str = "sin"
    max_upload_mb: int = Field(default=25, ge=1, le=100)

    @field_validator("database_url")
    @classmethod
    def require_postgres(cls, value: str) -> str:
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL must use postgresql+psycopg://")
        return value

    @field_validator("cors_origins")
    @classmethod
    def explicit_origins(cls, value: list[str]) -> list[str]:
        if "*" in value:
            raise ValueError("Configure explicit CORS origins")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
