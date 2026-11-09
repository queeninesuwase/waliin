import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from config import settings
from models import User
from repositories import session_repository, user_repository
from security.tokens import hash_token, new_token


@dataclass
class ActiveSession:
    user_id: UUID
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    mfa_verified: bool = False
    user: User | None = None


def _now():
    return datetime.now(timezone.utc)


def _idle_limit(user_session):
    return user_session.last_seen_at + timedelta(minutes=settings.session_idle_minutes)


def _to_data(user_session):
    return {
        "user_id": str(user_session.user_id),
        "created_at": user_session.created_at.isoformat(),
        "last_seen_at": user_session.last_seen_at.isoformat(),
        "expires_at": user_session.expires_at.isoformat(),
        "mfa_verified": user_session.mfa_verified,
    }


def _from_data(data):
    return ActiveSession(
        user_id=UUID(data["user_id"]),
        created_at=datetime.fromisoformat(data["created_at"]),
        last_seen_at=datetime.fromisoformat(data["last_seen_at"]),
        expires_at=datetime.fromisoformat(data["expires_at"]),
        mfa_verified=data.get("mfa_verified", False),
    )


def _save(token_hash, user_session, now):
    ends_at = min(user_session.expires_at, _idle_limit(user_session))
    seconds = max(1, math.ceil((ends_at - now).total_seconds()))
    session_repository.save_session(token_hash, _to_data(user_session), seconds)


def start_session(db, user_id, now=None, mfa_verified=False):
    now = now or _now()
    raw_token, token_hash = new_token()
    user_session = ActiveSession(
        user_id=user_id,
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(hours=settings.session_max_hours),
        mfa_verified=mfa_verified,
    )
    _save(token_hash, user_session, now)
    return raw_token


def get_active_session(db, raw_token, now=None):
    if not raw_token:
        return None
    now = now or _now()
    token_hash = hash_token(raw_token)
    data = session_repository.get_session(token_hash)
    if data is None:
        return None

    user_session = _from_data(data)
    if now >= user_session.expires_at or now >= _idle_limit(user_session):
        session_repository.delete_session(token_hash, user_session.user_id)
        return None

    user = user_repository.get_user_by_id(db, user_session.user_id)
    if user is None:
        session_repository.delete_session(token_hash, user_session.user_id)
        return None

    user_session.last_seen_at = now
    _save(token_hash, user_session, now)
    user_session.user = user
    return user_session


def end_session(db, raw_token):
    if not raw_token:
        return
    token_hash = hash_token(raw_token)
    data = session_repository.get_session(token_hash)
    if data is not None:
        session_repository.delete_session(token_hash, data["user_id"])


def end_all_sessions(db, user_id):
    return session_repository.delete_sessions_for_user(user_id)


def replace_with_verified_session(db, raw_token, user_id):
    end_session(db, raw_token)
    return start_session(db, user_id, mfa_verified=True)
