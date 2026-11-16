"""Workspace lifecycle. Study routes share the scoped session dependency."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.db.models import Workspace, Document

router = APIRouter()
class WorkspaceInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    @field_validator("name")
    @classmethod
    def name_required(cls, value):
        if not value.strip():
            raise ValueError("Name is required")
        return value.strip()

def data(item, db):
    return {"id": str(item.id), "name": item.name, "description": item.description,
            "source_count": db.scalar(select(func.count()).select_from(Document).where(Document.workspace_id == item.id)),
            "updated_at": item.updated_at.isoformat()}

@router.get("/workspaces")
def list_workspaces(db: Session = Depends(get_db)):
    return [data(w, db) for w in db.scalars(select(Workspace).order_by(Workspace.updated_at.desc()))]

@router.post("/workspaces", status_code=201)
def create_workspace(body: WorkspaceInput, db: Session = Depends(get_db)):
    item = Workspace(**body.model_dump()); db.add(item); db.commit(); db.refresh(item)
    return data(item, db)

@router.get("/workspaces/{workspace_id}")
def get_workspace(workspace_id: UUID, db: Session = Depends(get_db)):
    return data(db.get(Workspace, workspace_id), db)

@router.post("/workspaces/{workspace_id}")
def rename_workspace(workspace_id: UUID, body: WorkspaceInput, db: Session = Depends(get_db)):
    item = db.get(Workspace, workspace_id)
    item.name, item.description = body.name, body.description
    db.commit(); db.refresh(item)
    return data(item, db)
