# Working study workflows

## Bilingual workspace and Singlish update - 2026-11-10

The reported `rudira patakaye karyan mnd` question is recognized in automatic and Singlish modes. A bounded vocabulary from ready documents in the selected source/subject improves conversion of unlisted terms, using Sinhala-to-Latin phonetic comparison with conservative fuzzy matching. English question forms remain unchanged. This is still approximate transliteration, not an accuracy guarantee. Gemini interpretation uses the same local fallback.

English/Sinhala interface selection persists in browser storage and updates the HTML language. Source text is preserved. New Gemini explanations follow the interface language; local passage answers keep the original excerpts. Chat history retains the source scope as metadata without a schema change.

The redesigned study desk has a compact collapsible sidebar and real source links. Chat scrolls independently of its composer, shows recent scoped history, and offers an optional source panel. Interpretation, provider/OCR details, and older questions are expandable. The library, reader, practice, fallback pages and status controls use the same bilingual visual system.

The configured Gemini key was accepted by the models listing (HTTP 200), but generation returned HTTP 503 with a high-demand message. No secret was printed or committed. This is a provider limitation, not proof of successful live generation. Local Singlish and source retrieval are tested independently of provider availability.

The retrieval update also matches the textbook intent synonyms කාර්ය / කෘත්‍ය and the OCR variant රැධිර / රුධිර. Function questions select a nearby heading and its following passage instead of truncating the first part of a long OCR sentence. The actual uploaded PDF now ranks page 12's blood-tissue functions passage first, including transport, protection and homeostasis.

Final verification:

| Check | Result |
| --- | --- |
| Python 3.11 backend and isolated PostgreSQL workflows | 62 passed |
| Frontend component/unit tests | 8 passed |
| TypeScript and Linux production build | Passed |
| Desktop/mobile browser acceptance, including bilingual tools, scoped informal Singlish, 320px navigation and composer visibility | 22 passed |
| Alembic schema comparison | No new upgrade operations |
| Actual uploaded PDF, reported Singlish phrase | Interpreted correctly; page 12 functions passage ranks first |
| Provider connectivity | Key accepted for model listing; generation returned 503 high demand |

UI screenshots were reviewed in both languages at desktop and mobile sizes under ignored `.artifacts/qa/`. Browser test databases and storage are disposable. The actual-workspace smoke request adds a cited question to existing history; no original uploads were removed.



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
