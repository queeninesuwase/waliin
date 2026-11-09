import pytest
from fastapi.testclient import TestClient
from database import get_db
from main import app
import repositories.session_repository as session_repository
from repositories.session_repository import MemoryCache
from security.login_limiter import login_limiter
from security.dependencies import get_current_user


@pytest.fixture
def client(db, monkeypatch, data):
    monkeypatch.setattr(session_repository, "cache", MemoryCache())
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: data["nurse"]
    login_limiter.clear()
    with TestClient(app, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()
    login_limiter.clear()


def test_create_and_get(client, data):
    body = {
        "recipient_user_id": str(data["nurse"].user_id),
        "notification_type": "fault_reported",
        "message": "hi",
    }
    res = client.post("/notifications/", json=body)
    assert res.status_code == 201
    nid = res.json()["notification_id"]
    g = client.get(f"/notifications/{nid}")
    assert g.status_code == 200


def test_list(client, data):
    res = client.get("/notifications/")
    assert res.status_code == 200


def test_mark_read(client, data):
    body = {
        "recipient_user_id": str(data["nurse"].user_id),
        "notification_type": "fault_reported",
        "message": "hi",
    }
    nid = client.post("/notifications/", json=body).json()["notification_id"]
    r = client.post(f"/notifications/{nid}/read")
    assert r.status_code == 200
    assert r.json()["read_at"] is not None
