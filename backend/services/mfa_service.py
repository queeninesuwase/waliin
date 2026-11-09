from datetime import datetime, timezone

from fastapi import status

from config import settings
from models import UserRole
from models.enums import AuditEntityType
from repositories import user_repository
from security.encryption import decrypt_text, encrypt_text
from security.totp import matching_step, new_secret, provisioning_uri
from services.audit_service import log_action
from services.errors import ServiceError


MFA_ROLES = {UserRole.HEALTH_MANAGER, UserRole.BIOMEDICAL_ENGINEER}


class MfaAlreadyEnabledError(ServiceError):
    status_code = status.HTTP_409_CONFLICT
    message = "MFA is already set up."


class MfaNotSetUpError(ServiceError):
    status_code = status.HTTP_409_CONFLICT
    message = "Set up your authenticator app first."


class InvalidMfaCodeError(ServiceError):
    status_code = status.HTTP_400_BAD_REQUEST
    message = "The code is not correct."


def _now(now):
    return now or datetime.now(timezone.utc)


def mfa_required(user):
    """Managers and engineers always require MFA; other users may enable it."""
    return UserRole(user.role) in MFA_ROLES or user.mfa_enabled


def next_step(user):
    """Return the next sign-in step."""
    if not mfa_required(user):
        return "done"
    return "mfa_verify" if user.mfa_enabled else "mfa_setup"


def sign_in_step(user, mfa_verified):
    return "done" if mfa_verified else next_step(user)


def start_setup(db, user):
    """Create an authenticator secret and return its provisioning URI."""
    user = user_repository.get_user_by_id_for_update(db, user.user_id)
    if user is None:
        raise MfaNotSetUpError
    if user.mfa_enabled:
        raise MfaAlreadyEnabledError

    secret = new_secret()
    user.mfa_secret_encrypted = encrypt_text(secret)
    user_repository.save_user(db, user)
    user_repository.commit(db)

    return secret, provisioning_uri(secret, user.email, settings.mfa_issuer)


def _accept_code(user, code, now):
    """Validate the authenticator code."""
    if user.mfa_secret_encrypted is None:
        raise MfaNotSetUpError

    secret = decrypt_text(user.mfa_secret_encrypted)
    if matching_step(secret, code, now.timestamp()) is None:
        raise InvalidMfaCodeError


def confirm_setup(db, user, code, now=None):
    """Verify the first authenticator code and enable MFA."""
    now = _now(now)
    user = user_repository.get_user_by_id_for_update(db, user.user_id)
    if user is None:
        raise MfaNotSetUpError
    if user.mfa_enabled:
        raise MfaAlreadyEnabledError

    _accept_code(user, code, now)
    user.mfa_enabled = True
    user_repository.save_user(db, user)
    log_action(db, user.user_id, "mfa_enabled", AuditEntityType.USER, user.user_id)
    user_repository.commit(db)


def verify_code(db, user, code, now=None):
    """Validate the authenticator code during sign-in."""
    now = _now(now)
    user = user_repository.get_user_by_id_for_update(db, user.user_id)
    if user is None or not user.mfa_enabled:
        raise MfaNotSetUpError

    _accept_code(user, code, now)
    user_repository.commit(db)
