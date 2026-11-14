"""Lazy engine construction keeps imports free of database connections."""

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session
from sqlalchemy import event
from sqlalchemy.orm import with_loader_criteria
from fastapi import Request, HTTPException
from uuid import UUID
from backend.db.models import Workspace, Document, Chat, Quiz, DEFAULT_WORKSPACE

from backend.config import get_settings


@lru_cache
def get_engine() -> Engine:
    return create_engine(
        get_settings().database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args={"connect_timeout": 5},
    )


@event.listens_for(Session, "do_orm_execute")
def workspace_filter(state):
    workspace_id = state.session.info.get("workspace_id")
    if workspace_id and state.is_select:
        for model in (Document, Chat, Quiz):
            state.statement = state.statement.options(with_loader_criteria(model, model.workspace_id == workspace_id, include_aliases=True))


def get_db(request: Request) -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        raw = request.path_params.get("workspace_id")
        if raw:
            try:
                workspace_id = UUID(str(raw))
            except ValueError:
                raise HTTPException(422, "Invalid workspace")
            if session.get(Workspace, workspace_id) is None:
                raise HTTPException(404, "Workspace not found")
            session.info["workspace_id"] = workspace_id
        elif not request.url.path.startswith("/workspaces"):
            # Legacy document links resolve their actual owner; collection routes use the default.
            owner = None
            for key, model in (("document_id", Document), ("quiz_id", Quiz)):
                if request.path_params.get(key):
                    try:
                        item = session.get(model, UUID(str(request.path_params[key])))
                        owner = item.workspace_id if item else None
                    except ValueError:
                        pass
            session.info["workspace_id"] = owner or DEFAULT_WORKSPACE
        yield session
