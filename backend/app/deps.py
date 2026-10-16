"""FastAPI dependencies: database session, current user, admin guard."""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Profile
from app.security import decode_access_token

__all__ = ["CurrentUser", "DbSession", "get_current_user", "get_db", "get_optional_user", "require_admin"]

_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def _user_from_credentials(
    credentials: HTTPAuthorizationCredentials | None, db: Session
) -> Profile | None:
    if credentials is None:
        return None
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        return None
    return db.get(Profile, user_id)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> Profile:
    user = _user_from_credentials(credentials, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> Profile | None:
    return _user_from_credentials(credentials, db)


def require_admin(user: Annotated[Profile, Depends(get_current_user)]) -> Profile:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


CurrentUser = Annotated[Profile, Depends(get_current_user)]
