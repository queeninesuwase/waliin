from fastapi.testclient import TestClient

from main import app


def test_health_is_public_and_returns_ok():
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_returns_ok_dict():
    from fastapi.testclient import TestClient

    from main import app

    with TestClient(app) as client:
        response = client.get("/health")
    assert isinstance(response.json(), dict)
    assert response.json().get("status") == "ok"
