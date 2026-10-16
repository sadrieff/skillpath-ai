"""FastAPI application entry point."""
import importlib
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.config import get_settings

DEFAULT_JWT_SECRET = "dev-only-change-me"
ROUTER_MODULES = ["auth", "courses", "lessons", "quizzes", "dashboard", "ai", "admin"]


def create_app() -> FastAPI:
    settings = get_settings()

    local_backend = any(host in settings.BACKEND_URL for host in ("localhost", "127.0.0.1"))
    if settings.JWT_SECRET == DEFAULT_JWT_SECRET and not local_backend:
        raise RuntimeError("JWT_SECRET has the default value, set a real one for a public deploy")

    app = FastAPI(title="SkillPath AI", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Required by authlib for the Google OAuth state/nonce handling.
    app.add_middleware(SessionMiddleware, secret_key=settings.JWT_SECRET)

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for name in ROUTER_MODULES:
        module_name = f"app.routers.{name}"
        try:
            module = importlib.import_module(module_name)
        except ModuleNotFoundError as exc:
            # Only skip when the router module itself is missing; real import errors propagate.
            if exc.name != module_name:
                raise
            continue
        router = getattr(module, "router", None)
        if router is not None:
            app.include_router(router, prefix="/api")

    return app


app = create_app()
