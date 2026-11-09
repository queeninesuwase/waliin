from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.enums import UserRole
from schemas.auth import (
    AcceptInviteRequest,
    CurrentUser,
    ForgotPasswordRequest,
    LoginRequest,
    MfaCodeRequest,
    ResetPasswordRequest,
)
from security.dependencies import get_current_session
from services import (
    auth_service,
    invitation_service,
    mfa_service,
    password_reset_service,
    session_service,
)

router = APIRouter(prefix="/auth", tags=["auth"])

Db = Annotated[Session, Depends(get_db)]


def client_ip(request: Request):
    return request.client.host if request.client else None


def set_session_cookie(response: Response, raw_token: str):
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=settings.session_max_hours * 60 * 60,
        path="/",
        secure=True,
        httponly=True,
        samesite="strict",
    )


@router.post("/login", response_model=CurrentUser)
def login(body: LoginRequest, request: Request, response: Response, db: Db):
    user, raw_token = auth_service.login(
        db, body.email, body.password, client_ip(request)
    )
    set_session_cookie(response, raw_token)

    return {
        "user_id": user.user_id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "department_id": user.department_id,
        "next_step": mfa_service.next_step(user),
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Db):
    session_service.end_session(db, request.cookies.get(settings.session_cookie_name))
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=True,
        httponly=True,
        samesite="strict",
    )


@router.get("/me", response_model=CurrentUser)
def me(
    user_session: Annotated[
        session_service.ActiveSession, Depends(get_current_session)
    ],
):
    user = user_session.user
    return {
        "user_id": user.user_id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "department_id": user.department_id,
        "next_step": mfa_service.sign_in_step(user, user_session.mfa_verified),
    }


@router.post("/mfa/setup")
def mfa_setup(
    user_session: Annotated[
        session_service.ActiveSession, Depends(get_current_session)
    ],
    db: Db,
):
    secret, otpauth_uri = mfa_service.start_setup(db, user_session.user)
    return {"secret": secret, "otpauth_uri": otpauth_uri}


@router.post("/mfa/confirm")
def mfa_confirm(
    body: MfaCodeRequest,
    request: Request,
    response: Response,
    user_session: Annotated[
        session_service.ActiveSession, Depends(get_current_session)
    ],
    db: Db,
):
    mfa_service.confirm_setup(db, user_session.user, body.code)
    raw_token = request.cookies.get(settings.session_cookie_name)
    new_token = session_service.replace_with_verified_session(
        db, raw_token, user_session.user.user_id
    )
    set_session_cookie(response, new_token)
    return {"next_step": "done"}


@router.post("/mfa/verify")
def mfa_verify(
    body: MfaCodeRequest,
    request: Request,
    response: Response,
    user_session: Annotated[
        session_service.ActiveSession, Depends(get_current_session)
    ],
    db: Db,
):
    mfa_service.verify_code(db, user_session.user, body.code)
    raw_token = request.cookies.get(settings.session_cookie_name)
    new_token = session_service.replace_with_verified_session(
        db, raw_token, user_session.user.user_id
    )
    set_session_cookie(response, new_token)
    return {"next_step": "done"}


@router.post("/accept-invite")
def accept_invite(body: AcceptInviteRequest, db: Db):
    user = invitation_service.accept_invitation(
        db, body.token, body.full_name, body.password, body.confirm_password
    )
    return {
        "message": "Your account is ready. You can now sign in.",
        "role": UserRole(user.role).value,
    }


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(body: ForgotPasswordRequest, request: Request, db: Db):
    password_reset_service.forgot_password(db, body.email, client_ip(request))
    return {"message": password_reset_service.FORGOT_PASSWORD_MESSAGE}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Db):
    password_reset_service.reset_password(
        db, body.token, body.password, body.confirm_password
    )
    return {"message": "Your password has been changed. Sign in with the new password."}
