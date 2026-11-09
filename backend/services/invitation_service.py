from datetime import datetime, timezone

from fastapi import status

from models import User, UserRole
from models.enums import AuditEntityType
from repositories import user_repository
from security.passwords import (
    PasswordPolicyError,
    check_password_policy,
    hash_password,
)
from security.tokens import (
    INVITATION_LIFETIME,
    expiry_from_now,
    hash_token,
    is_expired,
    new_token,
)
from services import email_service
from services.audit_service import log_action
from services.auth_service import normalize_email
from services.email_service import EmailError
from services.errors import ServiceError
from services.user_service import (
    AccountRevokedError,
    DuplicateEmailError,
    InvalidUserDetailsError,
    InvitationAlreadyAcceptedError,
    UnknownDepartmentError,
    check_invitable_role,
)

INVITATION_HOURS = int(INVITATION_LIFETIME.total_seconds() // 3600)


class InvalidInvitationError(ServiceError):
    status_code = status.HTTP_400_BAD_REQUEST
    message = (
        "This invitation link is invalid or has expired. "
        "Ask your health manager for a new one."
    )


class InvitationEmailError(ServiceError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "The invitation email could not be sent. Try again."


def send_invitation(db, email, raw_token, failure_message):
    try:
        email_service.send_invitation_email(email, raw_token, INVITATION_HOURS)
    except EmailError:
        user_repository.rollback(db)
        raise InvitationEmailError(failure_message) from None


def invite_user(db, manager, email, role, department_id, now=None):
    email = normalize_email(email)
    check_invitable_role(role)
    if user_repository.get_user_by_email(db, email) is not None:
        raise DuplicateEmailError
    if user_repository.get_active_department(db, department_id) is None:
        raise UnknownDepartmentError

    raw_token, token_hash = new_token()
    user = User(
        email=email,
        role=UserRole(role),
        department_id=department_id,
        invited_by=manager.user_id,
        invitation_token_hash=token_hash,
        invitation_expires_at=expiry_from_now(INVITATION_LIFETIME, now),
    )
    user_repository.add_user(db, user)
    log_action(
        db,
        manager.user_id,
        "user_invited",
        AuditEntityType.USER,
        user.user_id,
        {"role": UserRole(role).value, "department_id": str(department_id)},
    )
    send_invitation(
        db,
        email,
        raw_token,
        "The invitation email could not be sent. Nothing was saved; try again.",
    )
    user_repository.commit(db)
    user_repository.refresh_user(db, user)
    return user


def resend_invitation(db, manager, user, now=None):
    if not user.is_active:
        raise AccountRevokedError
    if user.invitation_accepted_at is not None:
        raise InvitationAlreadyAcceptedError

    raw_token, token_hash = new_token()
    user.invitation_token_hash = token_hash
    user.invitation_expires_at = expiry_from_now(INVITATION_LIFETIME, now)
    user_repository.save_user(db, user)
    log_action(db, manager.user_id, "invite_resent", AuditEntityType.USER, user.user_id)
    send_invitation(
        db, user.email, raw_token, "The invitation email could not be sent. Try again."
    )
    user_repository.commit(db)
    return user


def accept_invitation(db, raw_token, full_name, password, confirm_password, now=None):
    now = now or datetime.now(timezone.utc)
    user = user_repository.get_user_by_invitation_hash(db, hash_token(raw_token))
    if (
        user is None
        or not user.is_active
        or user.invitation_accepted_at is not None
        or is_expired(user.invitation_expires_at, now)
    ):
        raise InvalidInvitationError

    full_name = full_name.strip()
    if not full_name:
        raise InvalidUserDetailsError("Full name is required.")
    if password != confirm_password:
        raise InvalidUserDetailsError("Passwords do not match.")
    try:
        check_password_policy(password, email=user.email)
    except PasswordPolicyError as error:
        raise InvalidUserDetailsError(str(error)) from None

    user.full_name = full_name
    user.password_hash = hash_password(password)
    user.invitation_accepted_at = now
    user.invitation_token_hash = None
    user.invitation_expires_at = None
    user_repository.save_user(db, user)
    log_action(
        db, user.user_id, "account_activated", AuditEntityType.USER, user.user_id
    )
    user_repository.commit(db)
    return user
