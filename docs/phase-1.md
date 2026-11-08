# Phase 1: foundation

Date: 2026-11-08 (Asia/Colombo).

**Implementation and automated checks pass. The phase is not fully accepted: visual browser verification is blocked by unavailable browser/native UI services. Phase 2 has not started.**

## Implemented

- Docker Compose: PostgreSQL 17 + pgvector, Python 3.11 FastAPI backend, and Next.js App Router frontend.
- Pydantic v2 environment configuration, explicit CORS origins, redacted API key fields, and local ignored storage.
- SQLAlchemy document/chunk/chat/quiz models, an Alembic initial migration, cosine HNSW index on `vector(1024)`, and a btree subject index.
- Database-aware `/health`, with a Sinhala error and HTTP 503 when schema/database readiness fails.
- Sinhala-only overview, bundled Noto Sans Sinhala, responsive CSS, Framer Motion with reduced-motion support, error/404 pages, and a real backend connection indicator.
- README architecture, quickstart, configuration, decisions, planned Sinhala processing approaches, limitations, and an explicitly unmeasured evaluation table.

## Acceptance evidence

| Check | Observed result |
| --- | --- |
| `docker compose up -d --wait` | Passed; all three containers running; database and backend healthy |
| `GET http://localhost:8000/health` | HTTP 200, `{"status":"ok","database":"ok"}` |
| Alembic upgrade on a fresh database | Passed |
| Alembic downgrade to base and re-upgrade | Passed in a uniquely named disposable database |
| `alembic check` | No new upgrade operations detected |
| Live vector/schema tests | `vector(1024)`, cosine HNSW and subject indexes, Sinhala round trip, cosine query, cascade deletion verified |
| Python 3.11 container tests, including live database | **13 passed** |
| Frontend Vitest | **4 passed** |
| TypeScript strict check | Passed |
| Next.js production build on host and Node 22 Linux image | Passed |
| Production homepage and bundled CSS/font requests | HTTP 200 |
| Sinhala visual rendering / desktop and mobile inspection | **Blocked**: browser access host and native Computer Use pipe unavailable |

The Python suite emits one upstream Starlette deprecation warning about its current httpx TestClient adapter. No test failures or application exceptions occurred.

## Environment-specific setup

- Started the installed Docker Desktop Linux engine.
- Used host port 55432 after Windows rejected binding 5432. Internal PostgreSQL port remains 5432.
- Used the Windows OS CA store for host npm requests. For Docker builds on this TLS-intercepted network, supplied public trusted CA certificates through an ignored local BuildKit secret override. Certificate validation stayed enabled; no certificates or local environment files are committed.
- Host Python 3.12 was used for auxiliary development checks. The acceptance suite was rerun inside the required Python **3.11.18** container.
- Linux Python dependencies are frozen in `backend/requirements.lock`; frontend dependencies are locked in `frontend/package-lock.json`.

## Pending gate

When browser access is restored, open http://localhost:3000 at desktop and mobile widths. Verify Sinhala conjuncts/diacritics, line spacing, absence of horizontal overflow, readable navigation, keyboard focus, reduced motion, guide anchor navigation, and the backend connection indicator. Then record the result here before starting ingestion.

This is a foundation preview. Upload, chat, quiz, OCR, embeddings, voice, and evaluation are not implemented or represented as tested.
