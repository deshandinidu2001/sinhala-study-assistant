# Workspace redesign verification - 2026-11-15

Akura opens with its introduction and persistent workspace cards. Create, rename, search and reopen a workspace; use Sources, Main Chat and Studio inside it. Desktop has independently scrolling panels and collapse controls; mobile uses three tabs. Sources support upload, pasted notes, search, selection, retry, reading and confirmed removal. Select at least one ready source before sending a chat question. Studio opens summaries, quizzes and Audio Overview, and lists saved outputs with language and creation date.

## Data and migration

Migration `0004_workspaces` creates a default workspace and assigns existing documents, chats and quizzes to it without changing their IDs. Document-owned summaries and recordings keep their existing storage locations. Submitted quiz results are now persisted; historical attempts did not store results, so those quizzes reopen for another attempt. Legacy document links resolve the owning workspace. Workspace filtering applies before retrieval candidate selection; explicit document and quiz endpoints validate ownership.

Before upgrading the local application, PostgreSQL was backed up as `.artifacts/workspace-backup/database.dump` and storage was copied to the adjacent `storage` directory. Backups and private source material remain ignored. After migration, all 18 backed-up storage files had identical SHA-256 hashes, with none missing. The existing default workspace exposes 12 summary caches, 10 quizzes and 2 recordings. Tests insert representative records before migration and verify their workspace assignment and preserved document identity, then downgrade and upgrade a disposable database. Alembic reports no schema drift.

## Checks

- Backend regression: 104 tests passed, including real PostgreSQL migration, workspace API and vector retrieval isolation, cross-workspace mutation rejection and saved quiz result reopening.
- Frontend: 16 unit tests passed; strict TypeScript and the Docker production build passed.
- Browser acceptance: 36 desktop/mobile Chromium tests passed against the production frontend and an isolated test API, database and storage. Coverage includes create/rename/search/reopen, scoped sources and chat history, uploads/pasted notes/OCR, document citations, no-selection behavior, quizzes, summaries, audio controls, language switching, provider failures and responsive overflow.
- The actual Docker application was rebuilt and restarted on ports 3000/8000; the database and API are healthy.
- Screenshots of home, workspace panels and saved Studio outputs are retained only in ignored `.artifacts/qa/`.
- Existing summaries and quizzes reopened in both layouts. An existing 175.84-second recording played, paused and sought successfully; its speed changed to 1.5x and its WAV download returned HTTP 200 with a valid RIFF header. These read-only checks produced no browser exceptions or horizontal overflow.

Provider responses in browser generation tests are controlled fixtures. These establish UI behavior, not live model quality. Existing recordings and saved outputs are checked separately in the running local application; replaying them does not establish fresh provider availability or Sinhala pronunciation quality. No new live generation or pronunciation claim is made in this redesign.

## Limits

Workspaces organize one trusted local application; they do not add accounts or user authorization. Generation still depends on configured providers and their availability. Optional Kimi inference remains unverified locally. Source removal deletes the document's cached summaries and recordings after confirmation. Back up PostgreSQL and storage together. No workspace deletion action was added.
