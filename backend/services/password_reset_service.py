from datetime import datetime, timezone

from fastapi import status

from config import settings
from models.enums import AuditEntityType, UserRole
from repositories import user_repository
from security.login_limiter import reset_limiter
from security.passwords import (
    PasswordPolicyError,
    check_password_policy,
    hash_password,
)
from security.tokens import (
    RESET_LIFETIME,
    expiry_from_now,
    hash_token,
    is_expired,
    new_token,
)
from services import email_service, session_service
from services.audit_service import log_action
from services.auth_service import normalize_email
from services.errors import ServiceError
from services.user_service import InvalidUserDetailsError

RESET_MINUTES = int(RESET_LIFETIME.total_seconds() // 60)

FORGOT_PASSWORD_MESSAGE = (
    "If an account uses this email, a link to reset the password has been sent."
)


class InvalidResetLinkError(ServiceError):
    status_code = status.HTTP_400_BAD_REQUEST
    message = "This reset link is invalid or has expired. Ask for a new one."


class TooManyResetRequestsError(ServiceError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    message = "Too many reset requests. Try again in 15 minutes."


class ResetNotAllowedError(ServiceError):
    status_code = status.HTTP_409_CONFLICT
    message = "Only active users who accepted their invitation can reset a password."


def can_reset(user):
    return (
        user is not None and user.is_active and user.invitation_accepted_at is not None
    )


def base_url_for(user):
    if UserRole(user.role) == UserRole.HEALTH_MANAGER:
        return settings.dashboard_base_url
    return settings.frontend_base_url


def request_reset(db, email, actor_user_id=None, now=None):
    user = user_repository.get_user_by_email(db, normalize_email(email))
    if not can_reset(user):
        return

    raw_token, token_hash = new_token()
    user.reset_token_hash = token_hash
    user.reset_token_expires_at = expiry_from_now(RESET_LIFETIME, now)
    user_repository.save_user(db, user)
    log_action(
        db,
        actor_user_id or user.user_id,
        "password_reset_requested",
        AuditEntityType.USER,
        user.user_id,
    )
    try:
        email_service.send_password_reset_email(
            user.email, raw_token, RESET_MINUTES, base_url_for(user)
        )
    except email_service.EmailError:
        user_repository.rollback(db)
        return
    user_repository.commit(db)


def forgot_password(db, email, ip=None, now=None):
    if reset_limiter.is_blocked(email, ip):
        raise TooManyResetRequestsError
    reset_limiter.record_failure(email, ip)
    request_reset(db, email, now=now)


def send_reset_link(db, manager, user, now=None):
    if not can_reset(user):
        raise ResetNotAllowedError
    request_reset(db, user.email, actor_user_id=manager.user_id, now=now)


def reset_password(db, raw_token, password, confirm_password, now=None):
    now = now or datetime.now(timezone.utc)
    user = user_repository.get_user_by_reset_hash(db, hash_token(raw_token))
    if not can_reset(user) or is_expired(user.reset_token_expires_at, now):
        raise InvalidResetLinkError

    if password != confirm_password:
        raise InvalidUserDetailsError("Passwords do not match.")
    try:
        check_password_policy(password, email=user.email)
    except PasswordPolicyError as error:
        raise InvalidUserDetailsError(str(error)) from None

    user.password_hash = hash_password(password)
    user.reset_token_hash = None
    user.reset_token_expires_at = None
    user.token_version += 1
    user_repository.save_user(db, user)
    log_action(db, user.user_id, "password_reset", AuditEntityType.USER, user.user_id)
    session_service.end_all_sessions(db, user.user_id)
    user_repository.commit(db)
    return user
