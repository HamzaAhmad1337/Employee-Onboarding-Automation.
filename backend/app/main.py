import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.routers import auth, documents, employees, notifications, templates

Base.metadata.create_all(bind=engine)

if settings.jwt_secret == "change-me-in-production":
    logging.getLogger("uvicorn.error").warning(
        "JWT_SECRET is not set - using the insecure default. Anyone who reads "
        "the source can forge valid tokens for any user, including hr_admin. "
        "Set the JWT_SECRET environment variable before deploying."
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
