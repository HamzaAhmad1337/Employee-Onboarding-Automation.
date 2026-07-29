import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Employee Onboarding Automation"
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./onboarding.db")
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me-in-production")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ]

    class Config:
        env_file = ".env"


settings = Settings()
