import os
import sys

from alembic import command
from alembic.config import Config as AlembicConfig
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, documents, employees, notifications, templates

# Schema is owned by Alembic migrations (alembic/versions/), not
# Base.metadata.create_all - create_all can only add brand-new tables, so it
# would silently no-op on every column added to an existing table (this app
# has already needed that three times: failed_login_attempts, locked_until,
# is_overdue's backing columns). Running migrations here keeps a fresh
# checkout and a running deployment on the same schema automatically.
_alembic_ini = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
command.upgrade(AlembicConfig(_alembic_ini), "head")

if settings.jwt_secret == "change-me-in-production":
    # Printed directly rather than via logging.getLogger("uvicorn.error") -
    # this module is imported before uvicorn finishes configuring its own
    # logging handlers, so a log call here was silently dropped in practice.
    print(
        "WARNING: JWT_SECRET is not set - using the insecure default. Anyone "
        "who reads the source can forge valid tokens for any user, including "
        "hr_admin. Set the JWT_SECRET environment variable before deploying.",
        file=sys.stderr,
    )

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(templates.router)
app.include_router(employees.router)
app.include_router(documents.router)
app.include_router(notifications.router)


@app.get("/health")
def health():
    return {"status": "ok"}
