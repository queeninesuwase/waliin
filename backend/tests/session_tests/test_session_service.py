import json
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from repositories import session_repository
from repositories.session_repository import MemoryCache
from security.tokens import hash_token
from services import session_service

NOW = datetime.now(timezone.utc)
ENGINEER = uuid.uuid4()
NURSE = uuid.uuid4()


class FakeDb:
    def __init__(self, *user_ids):
        self.users = {
            user_id: SimpleNamespace(user_id=user_id, is_active=True)
            for user_id in user_ids
        }

    def get(self, model, user_id):
        return self.users.get(user_id)


@pytest.fixture(autouse=True)
def cache(monkeypatch):
    fresh = MemoryCache()
    monkeypatch.setattr(session_repository, "cache", fresh)
    return fresh


@pytest.fixture
def db():
    return FakeDb(ENGINEER, NURSE)


def stored(raw_token):
    return session_repository.get_session(hash_token(raw_token))


def test_start_session_stores_only_the_token_hash(db, cache):
    raw_token = session_service.start_session(db, ENGINEER, now=NOW)
    assert stored(raw_token)["user_id"] == str(ENGINEER)
    assert all(raw_token not in key for key in cache._values)
    saved_values = json.dumps([str(value) for value in cache._values.values()])
    assert raw_token not in saved_values


def test_new_session_lasts_8_hours_and_needs_mfa(db):
    raw_token = session_service.start_session(db, ENGINEER, now=NOW)
    saved = stored(raw_token)
    assert datetime.fromisoformat(saved["expires_at"]) == NOW + timedelta(hours=8)
    assert saved["mfa_verified"] is False


def test_active_session_is_found_and_last_seen_is_updated(db):
    raw_token = session_service.start_session(db, NURSE, now=NOW)
    later = NOW + timedelta(minutes=10)
    found = session_service.get_active_session(db, raw_token, now=later)
    assert found is not None
    assert found.user_id == NURSE
    assert found.user.user_id == NURSE
    assert found.last_seen_at == later
    assert datetime.fromisoformat(stored(raw_token)["last_seen_at"]) == later


def test_activity_keeps_the_session_alive(db):
    raw_token = session_service.start_session(db, NURSE, now=NOW)
    for minutes in (10, 20, 30):
        assert session_service.get_active_session(
            db, raw_token, now=NOW + timedelta(minutes=minutes)
        )


def test_session_ends_after_15_idle_minutes(db):
    raw_token = session_service.start_session(db, NURSE, now=NOW)
    later = NOW + timedelta(minutes=15)
    assert session_service.get_active_session(db, raw_token, now=later) is None
    assert stored(raw_token) is None


def test_session_ends_after_8_hours_even_when_active(db):
    raw_token = session_service.start_session(db, NURSE, now=NOW)
    moment = NOW
    while moment < NOW + timedelta(hours=8) - timedelta(minutes=10):
        moment += timedelta(minutes=10)
        assert session_service.get_active_session(db, raw_token, now=moment)
    end = NOW + timedelta(hours=8)
    assert session_service.get_active_session(db, raw_token, now=end) is None


def test_unknown_token_is_refused(db):
    assert session_service.get_active_session(db, "made-up-token", now=NOW) is None


def test_missing_token_is_refused(db):
    assert session_service.get_active_session(db, None, now=NOW) is None


def test_session_of_a_deleted_user_is_refused(db):
    raw_token = session_service.start_session(db, NURSE, now=NOW)
    db.users.pop(NURSE)
    assert session_service.get_active_session(db, raw_token, now=NOW) is None
    assert stored(raw_token) is None


def test_logout_ends_only_that_session(db):
    phone = session_service.start_session(db, ENGINEER, now=NOW)
    laptop = session_service.start_session(db, ENGINEER, now=NOW)
    session_service.end_session(db, phone)
    assert session_service.get_active_session(db, phone, now=NOW) is None
    assert session_service.get_active_session(db, laptop, now=NOW) is not None


def test_logout_with_unknown_token_does_nothing(db):
    raw_token = session_service.start_session(db, ENGINEER, now=NOW)
    session_service.end_session(db, "made-up-token")
    assert session_service.get_active_session(db, raw_token, now=NOW) is not None


def test_end_all_sessions_signs_the_user_out_everywhere(db):
    first = session_service.start_session(db, ENGINEER, now=NOW)
    second = session_service.start_session(db, ENGINEER, now=NOW)
    nurse_token = session_service.start_session(db, NURSE, now=NOW)
    assert session_service.end_all_sessions(db, ENGINEER) == 2
    assert stored(first) is None
    assert stored(second) is None
    assert session_service.get_active_session(db, nurse_token, now=NOW) is not None
