# IQ Platform — Full Claude Context

> This file is the single source of truth for handing this project off to Claude.
> It covers architecture, every workflow, the PDF pipeline in detail, database schema, API contracts, and known gaps.

---

## 1. What This Project Is

**IQ (Intelligent Question Bank)** — a full-stack exam platform for JEE/NEET coaching institutes.

Teachers upload PDF question papers → AI extracts and classifies every question → questions land in a Review Queue → approved questions go into live tests → students take proctored exams in a secure sub-app.

---

## 2. Repo Layout

```
IQ/
├── backend/              NestJS API  → port 3000
├── frontend/             React/Vite Teacher Portal → port 5173
├── exam/
│   ├── backend/          NestJS Exam API → port 3001
│   └── frontend/         React/Vite Proctored Exam Shell → port 5175
├── pdf proccesor/        Standalone copy of the Python pipeline (for experimenting)
├── scripts/              One-off DB seeding/migration scripts (Node.js)
├── backend/scripts/pdf-processor/   THE REAL pipeline invoked by the API
│   ├── extract.py
│   ├── classify.py
│   └── qtypes.py
├── backend/migrations/   Supabase SQL migrations (run in order in Supabase SQL Editor)
├── docker-compose.yml
├── package.json          Root orchestration (concurrently)
└── .env / .env.example
```

---

## 3. Services & Ports

| Service | Port | Directory | Start command |
|---|---|---|---|
| Portal API | 3000 | `backend/` | `npm --prefix backend run start:dev` |
| Portal Web | 5173 | `frontend/` | `npm --prefix frontend run dev` |
| Exam API | 3001 | `exam/backend/` | `npm --prefix exam/backend run start:dev` |
| Exam Web | 5175 | `exam/frontend/` | `npm --prefix exam/frontend run dev` |

**Start all 4 at once from repo root:**
```bash
npm run dev
```

**Install all deps first (one-time):**
```bash
npm run install:all
```

---

## 4. Environment Variables (`.env` / `backend/.env`)

Copy `.env.example` to both `.env` (repo root) and `backend/.env`.

```env
# Supabase
SUPABASE_URL=https://fkvpkhgrtxanfznkvzqp.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # bypasses RLS — server only
SUPABASE_JWT_SECRET=<optional — for local HS256 token verification>

# AI pipeline
GROQ_API_KEY=gsk_key1,gsk_key2,...    # comma-separated list; engine round-robins on 429
VISION_API_KEY=                        # optional fallback vision model key
VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
PYTHON_BIN=                            # defaults: python3 on Linux, python on Windows

# URLs
FRONTEND_URL=http://localhost:8080
CORS_ORIGINS=http://localhost:8080     # comma-separated in production
PASSWORD_RESET_REDIRECT_URL=http://localhost:8080/reset-password
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000

# Cache / scaling
REDIS_URL=                             # leave blank for single-instance dev
LEADERBOARD_TTL_SECONDS=300
COHORT_TTL_SECONDS=120

# Rate limiting
THROTTLE_LIMIT=300                     # requests per minute, per authenticated user
TRUST_PROXY=1

# Attempt sweeper
ATTEMPT_SWEEP_INTERVAL_MS=60000
ATTEMPT_SWEEP_DISABLED=false

# Swagger (off in prod unless explicitly true)
ENABLE_SWAGGER=false
```

---

## 5. Database (Supabase)

**Project URL:** `https://fkvpkhgrtxanfznkvzqp.supabase.co`

### 5.1 Run Migrations

Run every file in `backend/migrations/` **in order** in the Supabase SQL Editor. All are idempotent.

| File | Purpose |
|---|---|
| `001_security_indexes_and_features.sql` | RLS on all user-data tables, base indexes, neg-marking, QA-review cols, spaced-repetition tables |
| `002_test_format_columns.sql` | Test format columns |
| `003_tests_assigned_to.sql` | `assigned_to` column |
| `004_test_teachers_junction.sql` | `test_teachers` junction table |
| `005_exam_session_sync.sql` | Answer palette state, `attempt_violations`, assignment rows |
| `006_scale_indexes.sql` | Indexes for cohort-scale queries |
| `007_test_paper_pattern.sql` | Paper pattern (`jee_main`, `custom`) separated from `test_type` |
| `008_question_type_taxonomy.sql` | Allows all q_types from the pipeline in `questions.q_type`; indexes Subject→Topic→QType drill-down |
| `009_test_results_published.sql` | Published results flag |

**Exam module also needs its own schema:**
1. `exam/backend/schema.sql`
2. `exam/backend/migrations/001_exam_hardening.sql`

> ⚠️ Without the exam schema, "Start Test" fails with 503. Without the hardening migration, `exam_sessions` is writable by any browser holding the anon key.

### 5.2 Key Tables

| Table | Purpose |
|---|---|
| `questions` | All questions. Columns: `id, subject, topic, subtopic, difficulty, q_type, question_text, image_url, options (jsonb), correct_answer (jsonb), marks, is_active, created_by, source, review_status` |
| `tests` | Exam metadata. Admin-only creation |
| `test_questions` | Junction: test ↔ question |
| `test_assignments` | Which students are assigned to which test |
| `test_teachers` | Which teachers are assigned to fill questions for which test |
| `attempts` | Student exam attempts; graded server-side |
| `batches` | Student cohorts |
| `lectures` | Syllabus resources |
| `doubts` | Real-time chat rooms |
| `exam_sessions` | Proctored exam sessions (exam sub-app) |
| `exam_responses` | Per-question real-time responses |
| `exam_violations` | Tab-switch / fullscreen-exit events |

### 5.3 Storage Buckets

| Bucket | Used for |
|---|---|
| `question-images` | PNG images extracted from PDFs. Path: `{runId}/{Subject}/{Topic}/{q_type}/{filename}.png` |
| `doubt-images` | Images uploaded in doubt chat |

### 5.4 `questions.q_type` Values

```
single_correct   → 4-option MCQ, one correct
multi_correct    → 4-option MCQ, one or more correct
numerical        → NAT — student types a number
assertion        → Assertion/Reason or Statement-1/Statement-2
subjective       → Free-text answer
```

### 5.5 `questions.review_status`

```
pending   → AI-extracted, not yet reviewed by a teacher. CANNOT enter a live test.
approved  → Reviewed and confirmed by a teacher. Can be used in tests.
rejected  → Discarded.
```

---

## 6. ⭐ The PDF Pipeline — Full Workflow

This is the most important and complex feature. Here is the complete end-to-end flow.

### 6.1 Trigger

A teacher (role: `teacher` or `admin`) uploads a PDF via the Teacher Portal:

```
POST /api/questions/upload-pdf
Content-Type: multipart/form-data
Authorization: Bearer <jwt>

Fields:
  file: <PDF binary>          max 50 MB, magic-bytes checked
  examType: jee|neet|cbse|general   default: jee
```

### 6.2 Backend Handler (`PdfProcessorService`)

File: `backend/src/modules/questions/pdf-processor.service.ts`

**Step-by-step:**

1. **Validation** — file buffer must start with `%PDF-` bytes; `examType` checked against allow-list (not interpolated into shell).

2. **Temp workspace** — creates `backend/temp/{runId}/output/`; writes PDF to `backend/temp/{runId}/exam.pdf`.

3. **WebSocket progress** — real-time progress events pushed to teacher's socket room (`teacherId`). Stages: `queued → extracting → classifying → uploading-images → saving → complete | failed`.

4. **Extract** — spawns Python (no shell):
   ```
   python extract.py exam.pdf --output-dir ./output --dpi 200
   ```
   Produces: `output/manifest.json` + `output/image_questions/{filename}.png`

5. **Classify** — spawns Python:
   ```
   python classify.py ./output --pdf exam.pdf --exam jee
   ```
   Produces: `output/manifest_classified.json` + `output/classified/{Subject}/{Topic}/{q_type}/{filename}.png`

6. **Parse manifest** — reads `manifest_classified.json` (array of question objects). Max 500 questions per run.

7. **Upload images** — for each question with a `classified_path`:
   - Resolves path safely (path traversal check)
   - Uploads PNG to `question-images` bucket at `{runId}/{Subject}/{Topic}/{q_type}/{filename}.png`
   - Gets public URL

8. **Build DB rows** — each row:
   ```json
   {
     "subject": "Physics",
     "topic": "Thermodynamics",
     "subtopic": null,
     "difficulty": "medium",
     "q_type": "single_correct",
     "question_text": "<extracted text or 'See attached image.'>",
     "image_url": "https://...supabase.co/storage/v1/object/public/question-images/...",
     "options": ["A", "B", "C", "D"],
     "correct_answer": { "index": 0 },
     "marks": 4,
     "is_active": true,
     "created_by": "<teacherId>",
     "source": "pdf",
     "review_status": "pending"
   }
   ```

9. **Bulk insert** — batched inserts into `questions` table (to avoid huge single request bodies).

10. **Cleanup** — `backend/temp/{runId}/` deleted (async, never blocks result).

**Timeouts:**
- extract.py: 5 minutes
- classify.py: 10 minutes

### 6.3 `extract.py` — What It Does

File: `backend/scripts/pdf-processor/extract.py`

- Uses **PyMuPDF (`fitz`)** to analyse geometric layout of PDF pages
- Detects question boundaries by Q-number regex (`x0 < 75` — left-margin position)
- Tracks **section banners** (e.g. "MULTIPLE CORRECT ANSWERS TYPE") and records which section each question belongs to — banners are NOT glued onto questions
- Pulls **answer keys** (`Ans: AC`) and crops them OUT of the student-facing image
- Exports 1-bit black & white dithered PNGs (~8 KB each — 95% smaller than RGB)
- Outputs:
  - `manifest.json` — raw extraction data per question (page, bounding_box, extracted_text, section_banner, answer_key)
  - `image_questions/q{n}_p{page}.png` — raw cropped images

### 6.4 `classify.py` — What It Does

File: `backend/scripts/pdf-processor/classify.py`

- Reads each manifest entry's extracted text
- For scans/pure-diagram questions where PyMuPDF extracted no text: falls back to **Groq vision model** (sends image as base64)
- Classifies each question into: **Subject, Topic, Question Type**
- Uses **seamless Groq key rotation**: comma-separated `GROQ_API_KEY` values, moves to next key on HTTP 429
- Supported exam taxonomies (`--exam`): `jee`, `neet`, `cbse`, `general`
- Outputs:
  - `manifest_classified.json` — full enriched manifest
  - `classified/{Subject}/{Topic}/{q_type}/{filename}.png` — organized images

### 6.5 `qtypes.py` — Question Type Detection

File: `backend/scripts/pdf-processor/qtypes.py`

Type detection priority (strongest first):
1. Instruction wording inside the question
2. Answer key naming 2+ options (overrides banner claim of single_correct)
3. Section banner
4. Bare-number answer key with no option list
5. Groq vision/text classifier decision
6. Visible option list
7. Default: `single_correct`

### 6.6 Python Dependencies

```
PyMuPDF
Pillow
groq
```

Install: `pip install -r backend/scripts/pdf-processor/requirements.txt`

Python must be on PATH. On Windows dev, `python`; on Linux/container, `python3` (or set `PYTHON_BIN` env var).

### 6.7 WebSocket Progress Events

The frontend connects via Socket.IO to `VITE_SOCKET_URL`. Progress events:

```typescript
{
  runId: string,
  stage: 'queued' | 'extracting' | 'classifying' | 'uploading-images' | 'saving' | 'complete' | 'failed',
  message: string,
  percent: number,       // 0-100 (-1 on failure)
  processed?: number,
  inserted?: number,
  byType?: Record<string, number>,
  error?: string
}
```

Gateway file: `backend/src/modules/questions/uploads.gateway.ts`

---

## 7. Backend Module Map (`backend/src/modules/`)

| Module | Key Responsibility |
|---|---|
| `auth` | Login, token refresh, logout, password reset/forgot. JWKS + HS256 fallback JWT verification |
| `users` | User CRUD, role management, student listings (paginated) |
| `batches` | Student cohort management |
| `questions` | Question CRUD, PDF upload pipeline, CSV upload, QA review queue, bulk operations |
| `tests` | Test creation (admin-only), question assignment, teacher collaboration, student assignment |
| `attempts` | Student exam attempts, server-side grading, negative marking, background sweeper |
| `doubts` | Real-time Socket.IO chat, per-room auth, image upload |
| `lectures` | Syllabus/lecture library |
| `analytics` | Subject/topic breakdowns, SM-2 spaced repetition, risk predictions |
| `leaderboard` | Cached leaderboard (Redis-backed, single-flight) |

---

## 8. Auth & Roles

**Roles:** `student`, `teacher`, `admin`

- JWT verified via Supabase JWKS (with HS256 fallback if `SUPABASE_JWT_SECRET` set)
- Role is always read from the **database** — never from the JWT claim alone
- Guards: `SupabaseAuthGuard` (auth), `RolesGuard` + `@Roles()` (authorization)
- Subject-scoped teachers: a teacher only sees/edits questions in their assigned subjects

**Key auth rules:**
- Creating a test → admin only
- PDF upload → teacher or admin
- Review queue approval → teacher or admin
- Student exam → student only
- Exam paper fetch requires: (1) assignment exists, (2) exam window is open

---

## 9. Test / Exam Flow

1. **Admin creates test** (`POST /api/tests/constructor`) with metadata + questions + student assignment
2. **Teacher adds subject questions** (`POST /api/tests/:id/questions`) — only for assigned teachers
3. **Student sees test on dashboard** (`GET /api/tests/available`)
4. **Student starts attempt** (`POST /api/attempts`) — server validates: assignment exists + window open
5. **Student submits** (`POST /api/attempts/:id/submit`) — graded server-side with negative marking
6. **Background sweeper** auto-grades abandoned attempts past deadline

**Proctored exam sub-app** (`exam/`):
- Launched via `#token=<access_token>` URL fragment
- Separate NestJS API on port 3001, separate React app on port 5175
- Tracks: violations (tab-hidden, fullscreen-exit, devtools), auto-terminates at 3 strikes
- Answer key NEVER sent to client

---

## 10. Correct Answer Schema

The `correct_answer` column is JSONB. Shape depends on `q_type`:

```json
// single_correct
{ "index": 2 }         // 0-based index into options array

// multi_correct
{ "indices": [0, 2] }  // 0-based indices

// numerical (NAT)
{ "value": 42.5 }      // number to match against student's input

// assertion / subjective
{ "index": 0 }         // or null — reviewer sets it
```

---

## 11. API Endpoints (Key Ones)

### Questions
```
GET    /api/questions             List questions (server-side pagination, filter by subject/topic/q_type/difficulty/review_status)
GET    /api/questions/review-queue  Pending AI-extracted questions
POST   /api/questions             Create question manually
PUT    /api/questions/:id         Update question
DELETE /api/questions/:id         Soft-delete (is_active = false)
POST   /api/questions/bulk-delete  Bulk soft-delete (up to 500 IDs)
POST   /api/questions/upload-pdf  Upload PDF → trigger pipeline
POST   /api/questions/upload-csv  CSV upload → preview
POST   /api/questions/confirm-csv  Confirm CSV import
PATCH  /api/questions/:id/approve  Approve from review queue (can include corrections)
PATCH  /api/questions/:id/reject   Reject from review queue
```

### Tests
```
POST   /api/tests/constructor     [Admin] Create full test
GET    /api/tests                 List tests
POST   /api/tests                 [Admin] Create test shell
GET    /api/tests/available       [Student] Get assigned tests
GET    /api/tests/:id             Get test details
PATCH  /api/tests/:id             Update test
DELETE /api/tests/:id             Delete test
POST   /api/tests/:id/questions   Set questions (assigned teachers)
POST   /api/tests/:id/assign      Assign students
POST   /api/tests/:id/teachers    Assign teachers
GET    /api/tests/:id/results     Get results
POST   /api/tests/:id/results/publish  Publish results to students
```

### Attempts
```
POST   /api/attempts              Start attempt
GET    /api/attempts/:id          Get attempt (with paper — requires open window)
PATCH  /api/attempts/:id/answer   Save answer
PATCH  /api/attempts/:id/flag     Flag/unflag question
POST   /api/attempts/:id/submit   Submit attempt
```

### Auth
```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
PATCH  /api/auth/change-password
```

---

## 12. Frontend Structure

Tech: **React + Vite + TypeScript + TailwindCSS + KaTeX (LaTeX rendering)**

Main pages (Teacher Portal at port 5173):
- `/login` — auth
- `/dashboard` — overview, stats
- `/questions` — question bank (paginated, filter, bulk ops, LaTeX rendered)
- `/questions/review` — QA review queue
- `/questions/upload` — PDF / CSV upload with live WebSocket progress
- `/tests` — test management
- `/tests/constructor` — [admin] test builder
- `/analytics` — spaced repetition, risk predictions
- `/leaderboard` — cohort leaderboard
- `/lectures` — syllabus library
- `/doubts` — real-time doubt chat
- `/admin` — user/batch management

Student Portal (same frontend, different role):
- `/student/dashboard` — assigned tests
- `/student/tests/:id/results` — post-exam results (score, rank, percentile, answer review)
- `/student/analytics` — personal analytics

---

## 13. Known Issues & Gaps

| Issue | Detail |
|---|---|
| BullMQ installed but unused | PDF pipeline runs inside the HTTP request. Large papers can tie up a worker. Should be moved to a queue job. |
| Tokens in `localStorage` | XSS → session compromise. Mitigation: httpOnly cookies + CSRF, but touches every request path. |
| `react-router` GHSA-qwww-vcr4-c8h2 | CSRF bypass in RSC mode. This app uses plain `BrowserRouter` (not RSC/framework mode), so not reachable. Fix requires migrating to React Router 8. |
| No self-registration | Accounts provisioned by admin only (by design for exam platform security). |
| Load testing not done | Architecture is correct (paging, chunking, Redis state) but k6/Artillery numbers still needed. |

---

## 14. Docker

```bash
# Full stack with Docker
docker compose up --build

# Ports: frontend → 8080, backend → 3000
# Redis for cache; Postgres/Auth stay in Supabase
```

For distributing to others: pre-built images on Docker Hub as `vaibhav010606/iq-backend:latest` and `vaibhav010606/iq-frontend:latest`.

---

## 15. Scripts (One-off DB Operations)

Located in `scripts/`:

| Script | Purpose |
|---|---|
| `import_questions.js` | Bulk import from `questions.json` |
| `import_inorganic_questions.js` | Inorganic chemistry import |
| `import_maths_numerical.js` | Maths numerical import |
| `generate_and_insert_chemistry.js` | Generate + insert chemistry MCQs |
| `format_all_maths.js` | Format maths question text |
| `decompile.py` | Decompile/extract from a source |

**To run any script:**
```bash
cd IQ
node scripts/import_questions.js
```

Scripts use `dotenv` from `backend/node_modules/dotenv` and `@supabase/supabase-js` from `backend/node_modules/@supabase/supabase-js`.

**DNS note for Windows dev:** If you get `ENOTFOUND` connecting to Supabase, add this at the top of any Node script:
```js
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
```

---

## 16. Testing

```bash
# Backend (129 tests)
cd backend && npm test

# Exam backend (7 tests)
cd exam/backend && npm test

# Frontend (19 tests)
cd frontend && npx vitest run
```

---

## 17. Supabase Client Pattern

The backend uses **two Supabase clients** (`backend/src/config/supabase.config.ts`):

1. **`supabase`** — Service Role client. Bypasses RLS. Used for all data access. NEVER exposed to browser.
2. **`supabaseAuth`** — Anon key client. Used only for auth flows (login, password verify, token refresh).
3. **`createUserAuthClient()`** — Throwaway auth client for isolated operations (e.g. verify current password before allowing change).

---

## 18. Pagination Pattern

All list endpoints return:
```json
{
  "data": [...],
  "total": 1234,
  "page": 1,
  "limit": 20,
  "totalPages": 62
}
```

The frontend `toList()` helper accepts either this shape or a bare array.

Internally, reads that can exceed 1,000 rows use `fetchAll` / `fetchAllIn` from `backend/src/common/db/query.util.ts` (Supabase caps at `db-max-rows` without signalling truncation).

---

## 19. Quick Reference — Start Dev

```powershell
# 1. Set env vars
copy .env.example .env
copy .env.example backend\.env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY

# 2. Install deps
npm run install:all

# 3. Run migrations in Supabase SQL Editor
# (run backend/migrations/001 through 009 in order)
# (run exam/backend/schema.sql then exam/backend/migrations/001_exam_hardening.sql)

# 4. Start all 4 services
npm run dev

# Portal: http://localhost:5173
# Portal API: http://localhost:3000/api
# Exam app: http://localhost:5175
# Exam API: http://localhost:3001
# Swagger (dev): http://localhost:3000/api/docs
```

