import pytest
from fastapi.testclient import TestClient

from config import settings
from database import get_db
from main import app
from repositories import session_repository
from repositories.session_repository import MemoryCache
from security.login_limiter import login_limiter, reset_limiter
from security.passwords import hash_password
from security.tokens import hash_token

PASSWORD = "maternity ward monitor"


@pytest.fixture
def client(db, monkeypatch):
    monkeypatch.setattr(session_repository, "cache", MemoryCache())
    app.dependency_overrides[get_db] = lambda: db
    login_limiter.clear()
    reset_limiter.clear()
    with TestClient(app, base_url="https://testserver") as test_client:
        yield test_client
    app.dependency_overrides.clear()
    login_limiter.clear()
    reset_limiter.clear()


@pytest.fixture
def accounts(db, data):
    hashed = hash_password(PASSWORD)
    for key in ("manager", "engineer", "nurse"):
        data[key].password_hash = hashed
    db.flush()
    return data


@pytest.fixture(autouse=True)
def emails(monkeypatch):
    from config import settings
    from services import email_service

    monkeypatch.setattr(settings, "email_backend", "memory")
    email_service.outbox.clear()
    yield email_service.outbox
    email_service.outbox.clear()


def mark_session_mfa_verified(client):
    raw_token = client.cookies.get(settings.session_cookie_name)
    assert raw_token, "Expected a session cookie after login"

    token_hash = hash_token(raw_token)
    session_key = session_repository.SESSION_PREFIX + token_hash
    raw_session = session_repository.cache.get(session_key)
    assert raw_session, "Expected the login session in the test cache"

    import json

    session_data = json.loads(raw_session)
    session_data["mfa_verified"] = True
    session_repository.cache.set(session_key, json.dumps(session_data))


@pytest.fixture
def manager_client(client, accounts):
    response = client.post(
        "/auth/login",
        json={"email": "meron@hospital.et", "password": PASSWORD},
    )
    assert response.status_code == 200
    mark_session_mfa_verified(client)
    return client
