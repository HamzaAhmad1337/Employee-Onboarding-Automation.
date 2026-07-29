# Employee Onboarding Automation

A full-lifecycle employee onboarding system: HR builds reusable onboarding
templates, assigns a template to each new hire, and tasks are automatically
generated and routed to the right role (HR, manager, IT, or the new hire
themselves). Everyone gets a live progress view; managers and the new hire
get in-app notifications as tasks complete.

## Stack

- **Backend**: FastAPI + SQLAlchemy, JWT auth, role-based access control
  (`hr_admin`, `manager`, `it`, `new_hire`). SQLite by default, Postgres via
  `DATABASE_URL`.
- **Frontend**: React + TypeScript (Vite), React Router.

## Running locally

### Backend

```bash
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn app.main:app --reload --port 8000
```

Env vars (optional, see `app/core/config.py`):
- `DATABASE_URL` (default: `sqlite:///./onboarding.db`)
- `JWT_SECRET` (set a real secret in production)
- `CORS_ORIGINS` (comma-separated, default covers local Vite dev)

The first registered account may self-assign the `hr_admin` role
(`POST /auth/register`); every account after that must be created by an
existing `hr_admin` via `POST /auth/users`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL` in `frontend/.env` if the backend isn't on
`http://localhost:8000`.

## Core concepts

- **OnboardingTemplate**: a reusable checklist (e.g. "Engineering") made of
  `TaskDefinition`s, each with a title, an assigned role, and a due offset
  in days from the hire's start date.
- **Employee**: an onboarding record for a new hire. Creating one with a
  `template_id` instantiates concrete `OnboardingTask`s with due dates
  computed from the start date.
- **Task status updates**: only the assigned role (or `hr_admin`) can move
  a task between `pending` / `in_progress` / `done` / `blocked`.
- **Documents**: per-employee file uploads (offer letters, signed NDAs),
  type- and size-restricted.
- **Notifications**: simple in-app feed, e.g. a manager is notified when a
  new hire is added to their team or a task completes.

## Known flaws fixed during development

`passlib[bcrypt]` 1.7.4 is incompatible with modern `bcrypt` releases
(`AttributeError: module 'bcrypt' has no attribute '__about__'`), which
crashed every registration/login. Password hashing now calls `bcrypt`
directly instead of going through passlib.
