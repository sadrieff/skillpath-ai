import pytest

from app.config import get_settings
from app.main import create_app


def test_default_secret_rejected_on_public_url(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "dev-only-change-me")
    monkeypatch.setenv("BACKEND_URL", "https://skillpath.example.com")
    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError):
            create_app()
    finally:
        get_settings.cache_clear()


def test_default_secret_allowed_on_localhost(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "dev-only-change-me")
    monkeypatch.setenv("BACKEND_URL", "http://localhost:8000")
    get_settings.cache_clear()
    try:
        create_app()
    finally:
        get_settings.cache_clear()
