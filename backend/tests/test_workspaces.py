"""Isolated transaction verifies scoping before retrieval and mutations."""
from uuid import uuid4
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend.db.models import Workspace, Document, Chat
from backend.db.session import get_engine, get_db
from backend.main import create_app

def test_workspace_routes_and_cross_workspace_rejection():
    with get_engine().connect() as connection:
        transaction = connection.begin()
        with Session(connection, join_transaction_mode="create_savepoint") as db:
            a, b = Workspace(name="A"), Workspace(name="B")
            db.add_all([a,b]); db.flush()
            doc = Document(title="Only A", subject="Science", filename="a.txt", workspace_id=a.id, status="ready")
            db.add(doc); db.flush()
            aid, bid, did = a.id, b.id, doc.id
            app = create_app()
            # Use the real dependency with a transaction-bound engine connection.
            with patch("backend.db.session.get_engine", return_value=connection):
                client = TestClient(app)
                assert client.get(f"/workspaces/{bid}/documents").json() == []
                assert client.get(f"/workspaces/{bid}/documents/{did}").status_code == 404
                assert client.delete(f"/workspaces/{bid}/documents/{did}").status_code == 404
                assert client.post(f"/workspaces/{bid}/chat", json={"question":"test", "document_ids":[str(did)]}).status_code == 404
                assert client.post(f"/workspaces/{aid}/chat", json={"question":"test", "document_ids":[]}).status_code == 422
                assert client.get(f"/workspaces/{uuid4()}").status_code == 404
                assert client.post('/workspaces',json={"name":"   "}).status_code == 422
        transaction.rollback()
