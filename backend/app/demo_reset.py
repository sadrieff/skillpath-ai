"""Wipe the demo database and uploads, then seed again: `python -m app.demo_reset`.

Refuses to run unless DEMO_MODE is true, so a real database is never wiped by accident.
"""
import sys
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.models import Base
from app.seed import seed

EXIT_NOT_DEMO = 2


def wipe_tables(db: Session) -> int:
    """Delete every row. Children go first: the reversed sorted order respects foreign keys."""
    rows = 0
    for table in reversed(Base.metadata.sorted_tables):
        rows += db.scalar(select(func.count()).select_from(table)) or 0
        db.execute(delete(table))
    db.commit()
    return rows


def wipe_uploads(upload_dir: Path) -> int:
    """Remove regular files directly inside upload_dir. Subdirectories and symlinks are left alone."""
    if not upload_dir.is_dir():
        return 0
    removed = 0
    for path in upload_dir.iterdir():
        if path.is_file() and not path.is_symlink():
            path.unlink()
            removed += 1
    return removed


def reset_demo(db: Session, upload_dir: Path) -> str:
    rows = wipe_tables(db)
    files = wipe_uploads(upload_dir)
    created = seed(db)
    return f"Demo reset: {rows} rows and {files} uploaded files removed, seeded {created}"


def main() -> int:
    if not get_settings().DEMO_MODE:
        print("Refusing to reset: DEMO_MODE is not true (this wipes the database).", file=sys.stderr)
        return EXIT_NOT_DEMO

    upload_dir = Path(get_settings().UPLOAD_DIR)
    with SessionLocal() as db:
        print(reset_demo(db, upload_dir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
