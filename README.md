# Employee Onboarding Automation

A full-lifecycle employee onboarding system: HR builds reusable onboarding
templates, assigns a template to each new hire, and tasks are automatically
generated and routed to the right role (HR, manager, IT, or the new hire
themselves). Everyone gets a live progress view with overdue-task flagging;
managers and new hires get in-app notifications as things happen.

## Stack

- **Backend**: FastAPI + SQLAlchemy, Alembic migrations, JWT auth,
  role-based access control (`hr_admin`, `manager`, `it`, `new_hire`).
  SQLite by default, Postgres via `DATABASE_URL`.
- **Frontend**: React + TypeScript (Vite), React Router.

## Running locally

### Backend

```bash
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn app.main:app --reload --port 8000
```

Migrations run automatically at startup (`app/main.py` calls
`alembic upgrade head` against whatever `DATABASE_URL` points at). To manage
migrations directly:

```bash
./.venv/bin/alembic revision --autogenerate -m "describe the change"
./.venv/bin/alembic upgrade head
```

Env vars (optional, see `app/core/config.py`):
- `DATABASE_URL` (default: `sqlite:///./onboarding.db`)
- `JWT_SECRET` (set a real secret in production - the default is
  intentionally insecure and logs a warning if left unset)
- `CORS_ORIGINS` (comma-separated, default covers local Vite dev)
- `UPLOAD_DIR` (default: `uploads/`, where employee documents are stored)

The **very first** account to register becomes `hr_admin` regardless of the
role it asks for (bootstrap). After that, `POST /auth/register` is closed
entirely — every other account (manager, IT, new hire, or an additional
hr_admin) must be created by an existing hr_admin via `POST /auth/users`.
This is deliberate: an open self-registration endpoint that lets anyone pick
their own role was a real vulnerability caught during development (see
below).

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
  in days from the hire's start date. Editable in place (`PUT`); editing
  doesn't retroactively change tasks already instantiated for employees who
  onboarded from an earlier version.
- **Employee**: an onboarding record for a new hire, distinct from their
  login account. Creating one with a `template_id` instantiates concrete
  `OnboardingTask`s with due dates computed from the start date. Auto-linked
  to the new hire's `User` account by matching email, whichever order HR
  creates them in, so the new hire can actually see their own onboarding.
- **Task status updates**: only the assigned role (or `hr_admin`) can move a
  task between `pending` / `in_progress` / `done` / `blocked`. Tasks past
  their due date and not yet `done` are flagged `is_overdue`.
- **Documents**: per-employee file uploads (offer letters, signed NDAs),
  type- and size-restricted, downloadable by anyone authorized to view that
  employee.
- **Notifications**: in-app feed (e.g. a manager is notified when a new hire
  joins their team or a task completes), polled every 30s, with per-item or
  mark-all-read.
- **Account lifecycle**: HR can edit or delete an employee record, and
  deactivate/reactivate or change the role of any account. Deactivation
  takes effect immediately, even against an already-issued unexpired token.

## Security notes

- Passwords are hashed with `bcrypt` directly (not via `passlib`, which is
  incompatible with modern `bcrypt` releases and crashes on every hash call
  as of this writing).
- Login is rate-limited: 5 failed attempts locks the account for 15 minutes,
  including against its own correct password. Login also runs a dummy hash
  on unknown emails to avoid a timing side-channel for account enumeration.
- Emails are normalized to lowercase on every entry point (register, login,
  employee creation) so `Admin@Co.com` and `admin@co.com` are the same
  account.
- Self-registration only ever creates the bootstrap `hr_admin`; all other
  accounts require an authenticated `hr_admin`.

## Known limitations

- No email delivery — notifications are in-app only, not emailed.
- No password reset flow (an hr_admin would need to deactivate/recreate the
  account, or a "set password" endpoint would need to be added).
- SQLite is fine for development; use Postgres (`DATABASE_URL`) for anything
  with concurrent writers.
