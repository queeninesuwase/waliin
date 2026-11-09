import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

TOKEN_BYTES = 32

INVITATION_LIFETIME = timedelta(hours=72)
RESET_LIFETIME = timedelta(minutes=5)


def new_token():
    raw_token = secrets.token_urlsafe(TOKEN_BYTES)
    return raw_token, hash_token(raw_token)


def hash_token(raw_token):
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def token_matches(raw_token, stored_hash):
    if not raw_token or not stored_hash:
        return False
    return hmac.compare_digest(hash_token(raw_token), stored_hash)


def expiry_from_now(lifetime, now=None):
    now = now or datetime.now(timezone.utc)
    return now + lifetime


def is_expired(expires_at, now=None):
    if expires_at is None:
        return True
    now = now or datetime.now(timezone.utc)
    return now >= expires_at
