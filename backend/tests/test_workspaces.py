"""Isolated transaction verifies scoping before retrieval and mutations."""
from uuid import uuid4
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend.db.models import Workspace, Document, Chat, Quiz, Chunk
from backend.study import retrieve
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
            chat = Chat(workspace_id=a.id, question="A private question", answer="A answer", sources=[], details={})
            quiz = Quiz(workspace_id=a.id, subject="A quiz", questions=[{"prompt":"Question", "options":["a","b"], "answer_index":0}])
            db.add_all([chat,quiz]); db.flush()
            db.add(Chunk(document_id=doc.id, page=1, chunk_index=0, text="Plants absorb sunlight for photosynthesis.", embedding=[1.0]+[0.0]*1023, token_count=8)); db.flush()
            # Verify the actual vector query is scoped before candidates are ranked.
            with patch("backend.study.vector", return_value=[1.0]+[0.0]*1023):
                db.info["workspace_id"] = b.id
                assert retrieve(db, "photosynthesis") == []
                db.info["workspace_id"] = a.id
                assert retrieve(db, "photosynthesis")[0]["document_id"] == str(doc.id)
                assert retrieve(db, "photosynthesis", document_ids=[]) == []
                db.info.pop("workspace_id")
            aid, bid, did = a.id, b.id, doc.id
            app = create_app()
            # Use the real dependency with a transaction-bound engine connection.
            with patch("backend.db.session.get_engine", return_value=connection):
                client = TestClient(app)
                assert client.get(f"/workspaces/{bid}/documents").json() == []
                assert client.get(f"/workspaces/{bid}/chats").json() == []
                assert client.get(f"/workspaces/{bid}/studio").json() == []
                assert client.get(f"/workspaces/{bid}/documents/{did}").status_code == 404
                assert client.delete(f"/workspaces/{bid}/documents/{did}").status_code == 404
                assert client.post(f"/workspaces/{bid}/chat", json={"question":"test", "document_ids":[str(did)]}).status_code == 404
                assert client.post(f"/workspaces/{bid}/questions/normalize", json={"question":"test", "document_id":str(did)}).status_code == 404
                for action in ("reprocess", "retry", "summary", "audio-review"):
                    assert client.post(f"/workspaces/{bid}/documents/{did}/{action}",json={}).status_code == 404
                for action in ("file", "pages/1/image", "summary", "audio-review", "audio/"+"a"*64, "saved-audio/"+"a"*64, "saved-summary/summary-"+"a"*24):
                    assert client.get(f"/workspaces/{bid}/documents/{did}/{action}").status_code == 404
                assert client.get(f"/workspaces/{bid}/quizzes/{quiz.id}").status_code == 404
                assert client.post(f"/workspaces/{bid}/quizzes/{quiz.id}/submit",json={"answers":[0]}).status_code == 404
                assert "answer_index" not in client.get(f"/workspaces/{aid}/quizzes/{quiz.id}").text
                graded = client.post(f"/workspaces/{aid}/quizzes/{quiz.id}/submit", json={"answers":[0]})
                assert graded.status_code == 200
                reopened = client.get(f"/workspaces/{aid}/quizzes/{quiz.id}").json()
                assert reopened["result"]["score"] == 1
                assert reopened["result"]["questions"][0]["selected_index"] == 0
                assert client.post(f"/workspaces/{aid}/chat", json={"question":"test", "document_ids":[]}).status_code == 422
                assert client.get(f"/workspaces/{uuid4()}").status_code == 404
                assert client.post('/workspaces',json={"name":"   "}).status_code == 422
        transaction.rollback()
