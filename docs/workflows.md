# Working study workflows

## PDF, Singlish, and Gemini update - 2026-11-10

Original PDFs now render as page images using embedded fonts and artwork, with page navigation, full PDF access, and an extracted-text view. FM/DL legacy Sinhala font detection triggers OCR even when a Unicode map returns Latin-looking text. Reprocessing preserves the original document ID and replaces its search chunks. Older quoted chat answers retain their original text.

Singlish accepts informal Latin spellings, including `MKD JIWA PATAKA KIYANNE`. An editable preview never submits automatically; history retains both the typed and interpreted questions. English/Sinhala can bypass conversion. The offline converter is approximate; Gemini optionally handles broader spellings and generates Sinhala explanations from retrieved excerpts.

Gemini credentials remain server-side in ignored `.env`. Provider requests have a configurable 15-second timeout per call, no automatic retries, structured response validation, and source-number validation. Missing keys, HTTP errors, timeouts, blocked/truncated output, malformed JSON, and invalid citations retain local passage answers. The configured banner does not claim provider connectivity. No-source queries do not invoke answer generation.

Verification for this update:

| Check | Result |
| --- | --- |
| Python 3.11 backend, real PostgreSQL workflows, extraction and Gemini fallback checks | 51 passed |
| Frontend Vitest | 7 passed |
| TypeScript and Linux production build | Passed |
| Desktop/mobile browser acceptance | 18 passed |
| Final PDF/Singlish browser regression checks after accessibility/copy fixes | 4 passed |
| Alembic schema comparison | No new upgrade operations |
| Actual legacy Sinhala PDF | 18 pages reprocessed; original page images and Sinhala OCR verified |
| Exact reported Singlish question against that PDF | Returned cited Sinhala passages |
| Runtime HTTPS to Gemini without credentials | TLS succeeded; expected HTTP 403 authentication response |

The browser suites use disposable databases and storage, and remove their test containers and volumes. Final screenshots are under ignored `.artifacts/qa/`. The actual workspace smoke check adds one cited answer to the user's existing question history. Public CA certificates supplied through the existing optional BuildKit trust secret are retained in the backend HTTPS trust bundle; certificate verification is enabled.

 Live Gemini generation remains unverified until a valid key is supplied. Mocked REST checks cover authentication headers, structured output, malformed output, provider errors, timeouts, and citation validation. The real uploaded 18-page legacy Sinhala PDF was reprocessed locally, visually checked at desktop/mobile widths, and returned cited passages for the exact Singlish question from the reported issue.

## Previous workflow baseline (2026-11-09)


Date: 2026-11-09 (Asia/Colombo).

## Original problem and implemented behavior

The original UI linked to overview anchors and exposed no upload, document, question, or practice endpoints. A healthy API did not mean those study functions existed. This change adds actual routes and persistent API workflows rather than presenting overview cards as working features.

- `/documents`: multi-file picker, drag/drop, pasted notes, subject/name fields, file validation, processing status, search, subject filtering, retry, and confirmed removal.
- `/documents/<id>`: source text with page/section navigation, original file access, and direct question/practice links.
- `/chat`: document/subject scope, persisted history, relevant verbatim source passages, numbered clickable citations, explicit no-match results, preserved input on errors, and editable browser dictation.
- `/practice`: source-based cloze multiple-choice questions, complete-answer validation, server-side grading, explanations, and source links. Correct answers are withheld until submission.
- Overview and sidebar: real routes, real recent documents, correct active navigation, and compatibility redirects for the old library/practice hashes.
- Storage: original files and extracted page JSON under UUID directories; PostgreSQL metadata and chunks; automatic recovery of pending/processing uploads after restart.
- Ingestion: UTF-8/UTF-16 text, PDF text, Word paragraphs/tables, and actual Sinhala/English Tesseract OCR for images and scanned PDF pages. File bytes, extensions, sizes, page counts, and extracted character counts are bounded. Error details do not disclose parser internals or database credentials.

The Alembic migration adds file size, processing errors, and extraction method while preserving existing data. No cloud account, secret, or model download was added.

## Verification

| Check | Result |
| --- | --- |
| Backend checks on Python 3.11, including real PostgreSQL workflows | 31 passed |
| Real OCR on PNG, JPG, WEBP, and scanned PDF | Passed |
| Unicode Sinhala, Word tables, Markdown, PDF page-2 citations | Passed |
| Invalid, empty, oversized, encrypted, and malformed file handling | Passed |
| Pending/processing document recovery after API restart | Passed |
| Correct/incorrect quiz grading and invalid-answer rejection | Passed |
| Frontend Vitest | 7 passed |
| Strict TypeScript | Passed |
| Linux Node 22 production build | Passed |
| Alembic schema comparison | No new upgrade operations |
| Rebuilt application health and library HTTP response | HTTP 200; database OK |
| Playwright browser acceptance on desktop and mobile Chromium | 14 passed |
| 320px navigation, library, practice, and chat overflow checks | Passed |
| Actual Sinhala image OCR through the isolated API | Passed |
| Late history responses preserve newly submitted answers | Passed |

All 14 browser tests passed in the final run. Tests exercise the production frontend with a real isolated API, temporary PostgreSQL database, and temporary storage volume. They do not insert example notes or history into the user's workspace. Browser screenshots are kept in ignored `.artifacts/qa/` and were visually inspected at desktop and mobile widths. The native browser connector was unavailable; acceptance used an isolated headless Chromium test browser. Test API containers, storage volumes, and databases were removed after completion.

## Practical limits

Answers are lexical source extraction, not generative AI or BGE-M3 semantic search. The UI and README state this clearly. Queries using source vocabulary work best; synonym-only or cross-language questions can return no match. No study-corpus benchmark or universal accuracy claim is made.

Quizzes are source-sentence fill-in-the-blank exercises, with up to five questions by default. Insufficient text produces a specific error. TXT/Markdown/Word citations refer to displayed text sections; PDF citations refer to actual PDF pages.

OCR quality varies with the source; check recognised text against originals. Browser dictation was exercised with a simulated recognition result to verify editable text and no automatic submission. Live microphone access, browser service availability, and real spoken Sinhala accuracy remain dependent on the user's device and browser.

The trusted local shared-workspace scope remains. Authentication, multi-user isolation, Whisper transcription, retrieval benchmarking, and public production deployment are not claimed. Optional Gemini integration is described in the 2026-11-10 update above; live provider generation requires a key.

Technical extraction references: [FastAPI file uploads](https://fastapi.tiangolo.com/tutorial/request-files/), [pypdf text extraction](https://pypdf.readthedocs.io/en/stable/user/extract-text.html), [Tesseract language data](https://github.com/tesseract-ocr/tessdoc/blob/main/Data-Files.md).
