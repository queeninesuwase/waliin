from fastapi import status

from repositories import user_repository
from security.passwords import (
    hash_password,
    needs_rehash,
    verify_dummy_password,
    verify_password,
)
from security.login_limiter import login_limiter
from services import mfa_service, session_service
from services.errors import ServiceError


class InvalidCredentialsError(ServiceError):
    status_code = status.HTTP_401_UNAUTHORIZED
    message = "Invalid email or password."


def normalize_email(email):
    return email.strip().lower()


def authenticate(db, email, password):
    """Return the user if the email and password are right, else raise InvalidCredentialsError."""
    user = user_repository.get_user_by_email(db, normalize_email(email))
    if user is None or not user.is_active or user.password_hash is None:
        verify_dummy_password(password)
        raise InvalidCredentialsError
    if not verify_password(user.password_hash, password):
        raise InvalidCredentialsError
    # The hash was made with older Argon2 settings: save a new one.
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        user_repository.save_user(db, user)
        user_repository.commit(db)
    return user


def sign_in(db, email, password):
    user = authenticate(db, email, password)
    mfa_verified = not mfa_service.mfa_required(user)

    raw_token = session_service.start_session(
        db,
        user.user_id,
        mfa_verified=mfa_verified,
    )
    return user, raw_token


class TooManyAttemptsError(ServiceError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    message = "Too many failed sign-in attempts. Try again in 15 minutes."


def login(db, email, password, ip=None):
    if login_limiter.is_blocked(email, ip):
        raise TooManyAttemptsError
    try:
        user, raw_token = sign_in(db, email, password)
    except InvalidCredentialsError:
        login_limiter.record_failure(email, ip)
        raise
    login_limiter.reset(email, ip)
    return user, raw_token
