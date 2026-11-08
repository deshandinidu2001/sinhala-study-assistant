"""FastAPI application entry point: uvicorn backend.main:app."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from backend.config import get_settings
from backend.db.session import get_engine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level)
    settings.storage_path.mkdir(parents=True, exist_ok=True)
    yield
    get_engine().dispose()


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    database: Literal["ok"] = "ok"


def database_is_ready() -> bool:
    with get_engine().connect() as connection:
        return bool(connection.execute(text(
            "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') "
            "AND EXISTS (SELECT 1 FROM alembic_version)"
        )).scalar_one())


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="සිංහල අධ්‍යයන සහායක", version="0.1.0", lifespan=lifespan,
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url=None,
    )
    application.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type"],
    )

    @application.get("/health", response_model=HealthResponse, tags=["health"])
    def health() -> HealthResponse | JSONResponse:
        try:
            if database_is_ready():
                return HealthResponse()
        except SQLAlchemyError:
            logger.warning("Database readiness check failed")
        return JSONResponse(status_code=503, content={
            "status": "unavailable", "detail": "දත්ත ගබඩාව සූදානම් නැත."
        })

    return application


app = create_app()
