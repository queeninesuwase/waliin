from config import settings
from repositories import session_repository

PASSWORD = "maternity ward monitor"

COOKIE = settings.session_cookie_name


def login(client, email, password=PASSWORD):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_nurse_signs_in_on_the_pwa(client, accounts):
    response = login(client, "tigist@hospital.et")
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "tigist@hospital.et"
    assert body["role"] == "clinical_staff"
    assert "password_hash" not in body


def test_session_cookie_is_secure(client, accounts):
    response = login(client, "abebe@hospital.et")
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{COOKIE}=")
    assert "HttpOnly" in cookie
    assert "Secure" in cookie
    assert "samesite=strict" in cookie.lower()
    assert "Path=/" in cookie


def test_manager_signs_in_on_the_dashboard(client, accounts):
    assert login(client, "meron@hospital.et").status_code == 200


def test_email_is_not_case_sensitive(client, accounts):
    assert login(client, "  Tigist@Hospital.ET ").status_code == 200


def test_wrong_password_and_unknown_email_give_the_same_reply(client, accounts):
    wrong = login(client, "tigist@hospital.et", password="wrong password here")
    unknown = login(client, "nobody@hospital.et")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "Invalid email or password."}


def test_invited_user_without_password_cannot_sign_in(client, db, accounts):
    from models import User, UserRole

    db.add(
        User(
            email="new@hospital.et",
            role=UserRole.CLINICAL_STAFF,
            department=accounts["dept"],
        )
    )
    db.flush()
    assert login(client, "new@hospital.et").status_code == 401


def test_deactivated_user_cannot_sign_in(client, db, accounts):
    accounts["nurse"].is_active = False
    db.flush()
    assert login(client, "tigist@hospital.et").status_code == 401


def test_sixth_attempt_is_blocked_after_five_failures(client, accounts):
    for _ in range(5):
        assert (
            login(
                client, "tigist@hospital.et", password="wrong password here"
            ).status_code
            == 401
        )
    assert login(client, "tigist@hospital.et").status_code == 429


def test_unknown_fields_are_refused(client, accounts):
    response = client.post(
        "/auth/login",
        json={
            "email": "tigist@hospital.et",
            "password": PASSWORD,
            "role": "health_manager",
        },
    )
    assert response.status_code == 422


def test_me_returns_the_signed_in_user(client, accounts):
    login(client, "abebe@hospital.et")
    response = client.get("/auth/me")
    assert response.status_code == 200
    assert response.json()["role"] == "biomedical_engineer"


def test_me_without_cookie_is_refused(client, accounts):
    assert client.get("/auth/me").status_code == 401


def test_me_with_made_up_cookie_is_refused(client, accounts):
    client.cookies.set(COOKIE, "made-up-token")
    assert client.get("/auth/me").status_code == 401


def test_logout_ends_the_session(client, db, accounts):
    login(client, "abebe@hospital.et")
    response = client.post("/auth/logout")
    assert response.status_code == 204
    assert not [
        key
        for key in session_repository.cache._values
        if key.startswith(session_repository.SESSION_PREFIX)
    ]
    assert client.get("/auth/me").status_code == 401


def test_logout_without_session_is_fine(client, accounts):
    assert client.post("/auth/logout").status_code == 204
