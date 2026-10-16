"""Application settings, loaded from environment variables (and an optional .env file)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    DATABASE_URL: str = "sqlite:///./skillpath.db"
    JWT_SECRET: str = "dev-only-change-me"
    JWT_EXPIRE_MINUTES: int = 10080

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"
    # Comma-separated list. Empty means: use FRONTEND_URL.
    CORS_ORIGINS: str = ""

    ENABLE_DEV_LOGIN: bool = False
    # Comma-separated list of emails that get role=admin on login.
    ADMIN_EMAILS: str = ""

    ROUTERAI_API_KEY: str = ""
    AI_BASE_URL: str = "https://routerai.ru/api/v1/chat/completions"
    AI_MODEL: str = "qwen/qwen3.5-flash-02-23"
    # Total tutor calls per UTC day across all users. 0 turns the cap off.
    AI_DAILY_LIMIT: int = 0

    # Public test stand: enables POST /api/auth/demo-login and `python -m app.demo_reset`.
    DEMO_MODE: bool = False
    # Demo logins per client IP per hour.
    DEMO_RATE_PER_HOUR: int = 20
    # Запросов к ИИ на одного пользователя в демо-режиме за всё время жизни аккаунта (0 = без лимита).
    DEMO_AI_PER_USER: int = 2

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 10

    @property
    def admin_emails_set(self) -> frozenset[str]:
        return frozenset(
            email.strip().lower() for email in self.ADMIN_EMAILS.split(",") if email.strip()
        )

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.CORS_ORIGINS.strip() or self.FRONTEND_URL
        return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
