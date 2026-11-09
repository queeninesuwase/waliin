from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import User, UserRole
from services import mfa_service, session_service
from services.session_service import ActiveSession


def get_current_session(request: Request, db: Annotated[Session, Depends(get_db)]):

    raw_token = request.cookies.get(settings.session_cookie_name)
    user_session = session_service.get_active_session(db, raw_token)
    if user_session is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in.")
    if not user_session.user.is_active:
        session_service.end_session(db, raw_token)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in.")
    return user_session


def get_current_user(
    user_session: Annotated[ActiveSession, Depends(get_current_session)],
):
    user = user_session.user

    if mfa_service.mfa_required(user) and not user_session.mfa_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Complete MFA setup or verification before accessing this resource.",
        )

    return user


def require_role(*roles):

    allowed = {UserRole(role) for role in roles}

    def check_role(user: Annotated[User, Depends(get_current_user)]):
        if UserRole(user.role) not in allowed:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "You do not have access to this."
            )
        return user

    return check_role
