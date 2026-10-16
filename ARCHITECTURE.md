# SkillPath AI — architecture contract

Learning platform: course → module → lesson → quiz → mistake analysis by AI tutor → progress.
This file is the **single source of truth** for all parts. Do not deviate; if something is
impossible, say so in your report instead of silently changing the contract.

## Stack
- Backend: Python 3.11+, FastAPI, SQLAlchemy 2.0 (sync), Alembic, PostgreSQL (prod/docker), SQLite (tests), pydantic v2, httpx, PyJWT, authlib (Google OAuth2), pytest.
- Frontend: Next.js 14 (App Router) + React + TypeScript + Tailwind CSS. Talks to backend over REST (`NEXT_PUBLIC_API_URL`, default `http://localhost:8000`).
- AI tutor: RouterAI, OpenAI-compatible chat completions. `AI_BASE_URL=https://routerai.ru/api/v1/chat/completions`, `AI_MODEL=qwen/qwen3.5-flash-02-23`, key in `ROUTERAI_API_KEY`. Key is read on the backend only.
- Infra: Docker, docker-compose (db, api, web), GitHub Actions (lint+tests for backend and frontend, docker build).

## Repo layout
```
backend/
  app/{main,config,db,models,schemas,deps,security,seed}.py
  app/routers/{auth,courses,lessons,quizzes,dashboard,ai,admin}.py
  app/services/ai_client.py
  alembic/ (+ alembic.ini)  tests/  requirements.txt  requirements-dev.txt  Dockerfile  .env.example
frontend/  (Next.js app)  Dockerfile  .env.example
docs/ai-log/   (prompts, generated code, found bugs, fixes — required for the defence)
docker-compose.yml  .github/workflows/ci.yml  README.md  ARCHITECTURE.md
```

## Database (see backend/app/models.py — already written, DO NOT edit)
Tables: profiles, courses, modules, lessons, enrollments, lesson_progress, quizzes, questions,
quiz_attempts, ai_messages. Passwords are never stored (Google OAuth only; `dev-login` for tests/demo).

## Config (backend/app/config.py, env via pydantic-settings)
DATABASE_URL (default `sqlite:///./skillpath.db`), JWT_SECRET, JWT_EXPIRE_MINUTES=10080,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKEND_URL (default http://localhost:8000),
FRONTEND_URL (default http://localhost:3000), CORS_ORIGINS (default = FRONTEND_URL),
ENABLE_DEV_LOGIN (default false), ADMIN_EMAILS (comma list; these emails get role=admin on login),
ROUTERAI_API_KEY, AI_BASE_URL, AI_MODEL, UPLOAD_DIR (default `./uploads`), MAX_UPLOAD_MB=10.

## Auth
Bearer JWT (HS256, claim `sub` = profile id) in `Authorization` header.
Deps in `app/deps.py`: `get_db`, `get_current_user` (401 if missing/invalid), `require_admin` (403 if role != admin).

## REST API (all under `/api`, JSON)
Auth
- `GET  /api/auth/google/login` → 302 to Google
- `GET  /api/auth/google/callback` → create/update profile, 302 to `{FRONTEND_URL}/auth/callback?token=<jwt>`
- `POST /api/auth/dev-login` `{email, full_name?}` → `{access_token, user}`; **404 unless ENABLE_DEV_LOGIN**
- `GET  /api/auth/me` → user `{id,email,full_name,avatar_url,role}`

Catalog / courses
- `GET  /api/courses?q=&category=&level=&limit=20&offset=0` → `{items:[CourseCard], total}`; `q` = case-insensitive substring in title. Public.
  CourseCard = `{id,title,description,category,level,duration_hours,lessons_count,enrolled,progress_percent}` (`enrolled/progress_percent` only meaningful with a token; otherwise false/0).
- `GET  /api/courses/categories` → `["Python", ...]`
- `GET  /api/courses/{id}` → CourseCard + `modules:[{id,title,position,lessons:[{id,title,position,completed}]}]`
- `POST /api/courses/{id}/enroll` → 201 `{enrolled:true}`; idempotent (200 if already)
- `DELETE /api/courses/{id}/enroll` → 204

Lessons and progress (enrolled students or admin only, else 403)
- `GET  /api/lessons/{id}` → `{id,title,content,video_url,material_url,module_id,course_id,completed,has_quiz,prev_lesson_id,next_lesson_id}`
- `POST /api/lessons/{id}/complete` → `{completed:true,course_progress_percent}` (idempotent)

Quizzes
- `GET  /api/lessons/{id}/quiz` → `{id,title,questions:[{id,text,options}]}` (**never** returns correct_index) ; 404 if none
- `POST /api/quizzes/{id}/attempts` `{answers:[{question_id,choice_index}]}` →
  `{attempt_id,score,total,percent,results:[{question_id,choice_index,correct,correct_index,explanation}]}`
  Every question must be answered, else 422. Passing (>=70%) auto-marks the lesson complete.

Dashboard
- `GET /api/me/dashboard` → `{stats:{courses_active,lessons_completed,avg_quiz_percent,quiz_attempts}, courses:[CourseCard+{next_lesson_id}], recent_attempts:[{attempt_id,quiz_title,lesson_id,percent,created_at}], recommendations:[CourseCard]}`
  recommendations = non-enrolled courses in the same categories as enrolled ones (fallback: newest courses), max 3.

AI tutor
- `POST /api/ai/tutor` `{lesson_id, mode, message?, attempt_id?}` → `{answer, message_id}`
  mode ∈ `explain_simple | example | explain_mistake | review_plan | question`.
  `explain_mistake` requires `attempt_id` (own attempt for this lesson) — the prompt contains the wrong questions, chosen vs correct answers. `question` requires `message`.
  Prompt includes lesson title + content (truncated to 6000 chars). Stores a row in `ai_messages`.
  Needs enrollment/admin. If ROUTERAI_API_KEY missing → 503 `{detail:"AI tutor is not configured"}`; upstream error → 502.
- `GET /api/ai/history?lesson_id=` → last 20 messages of current user for that lesson, oldest first.

Admin (`require_admin`)
- `GET/POST /api/admin/courses`, `PUT/DELETE /api/admin/courses/{id}` (fields: title,description,category,level,duration_hours)
- `POST /api/admin/courses/{id}/modules`, `PUT/DELETE /api/admin/modules/{id}` (title,position)
- `POST /api/admin/modules/{id}/lessons`, `PUT/DELETE /api/admin/lessons/{id}` (title,content,video_url,material_url,position)
- `PUT /api/admin/lessons/{id}/quiz` → upsert whole quiz `{title,questions:[{text,options,correct_index,explanation}]}`; `DELETE` removes it. `GET` returns it WITH correct_index.
- `POST /api/admin/upload` multipart `file` (pdf/png/jpg/txt/md, <= MAX_UPLOAD_MB) → `{url:"/uploads/<uuid>.<ext>"}`; files served statically at `/uploads`.
- `GET /api/admin/stats` → `{users,courses,lessons,enrollments,attempts}`

Errors: FastAPI default `{detail}`; 401/403/404/422 as above. Health: `GET /health` → `{status:"ok"}`.

## Frontend pages (Next.js App Router, `frontend/app/...`)
1. `/` — landing + Google sign-in button (+ "demo login" button visible only when `NEXT_PUBLIC_ENABLE_DEV_LOGIN=1`)
2. `/dashboard` — stats cards, active courses with progress bars, recent quiz results, recommendations
3. `/courses` — search, category & level filters, course cards, enroll button
4. `/courses/[id]` — description, modules/lessons tree with completed marks, progress, enroll
5. `/lessons/[id]` — markdown content, video/PDF link, mark complete, prev/next, quiz, AI tutor panel (quick-mode buttons + free question + history)
6. `/admin` — tabs: courses / modules+lessons / quiz editor / upload; guarded by role
+ `/auth/callback` stores token (localStorage `sp_token`) and redirects to `/dashboard`.
Design: dark navy background (#0b1020), violet accent (#7c3aed), cards, responsive (mobile + desktop), Russian UI text.
Shared: `frontend/lib/api.ts` (typed fetch wrapper adding Bearer), `frontend/lib/types.ts`, `frontend/components/*`.

## Writing style (binding for every text in the repo)
README, docs, UI copy, commit messages and code comments must not sound like generated text: no slogans or hype
("мощный", "бесшовный", "современное решение"), no bold-label bullet lists everywhere, no emoji, no intro/outro filler,
no rule-of-three padding. Write plainly and concretely, like a student who built this and explains it. Short sentences,
real facts, comments only where the code is not obvious.
