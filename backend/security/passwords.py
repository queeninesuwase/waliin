import threading
from functools import lru_cache

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_LENGTH = 128

COMMON_PASSWORDS = frozenset(
    {
        "123456789012",
        "password1234",
        "passwordpassword",
        "qwertyuiop12",
        "iloveyou1234",
        "admin1234567",
        "welcome12345",
        "abcdefghijkl",
        "111111111111",
        "000000000000",
        "waliin123456",
        "hospital1234",
    }
)

_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)

MAX_PARALLEL_HASHES = 4
_hash_slots = threading.BoundedSemaphore(MAX_PARALLEL_HASHES)


class PasswordPolicyError(ValueError):
    """Raised when a new password does not follow the password rules."""


def check_password_policy(password, email=None):
    if len(password) < MIN_PASSWORD_LENGTH:
        raise PasswordPolicyError(
            f"Password must have at least {MIN_PASSWORD_LENGTH} characters."
        )
    if len(password) > MAX_PASSWORD_LENGTH:
        raise PasswordPolicyError(
            f"Password must have at most {MAX_PASSWORD_LENGTH} characters."
        )
    if password.lower() in COMMON_PASSWORDS:
        raise PasswordPolicyError("This password is too common. Choose another one.")
    if email and password.lower() == email.lower():
        raise PasswordPolicyError("Password must not be the same as the email address.")


def hash_password(password):
    with _hash_slots:
        return _hasher.hash(password)


def verify_password(stored_hash, password):
    if not stored_hash:
        return False
    with _hash_slots:
        try:
            return _hasher.verify(stored_hash, password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False


def needs_rehash(stored_hash):
    return _hasher.check_needs_rehash(stored_hash)


@lru_cache(maxsize=1)
def _dummy_hash():
    return _hasher.hash("waliin-dummy-password-for-unknown-emails")


def verify_dummy_password(password):
    verify_password(_dummy_hash(), password)
    return False
