"""Tests for routers/users.py (health manager only) and POST /auth/accept-invite."""

import re

from sqlalchemy import select

from models import User

PASSWORD = "maternity ward monitor"  # same as in conftest.py
NEW_PASSWORD = "labour ward night shift"


def invite(client, data, email="selam@hospital.et", role="clinical_staff"):
    return client.post(
        "/users",
        json={
            "email": email,
            "role": role,
            "department_id": str(data["dept"].department_id),
        },
    )


def token_from(email_message):
    return re.search(
        r"token=([\w-]+)",
        email_message.get_body(preferencelist=("plain",)).get_content(),
    ).group(1)


# ---------------------------------------------------------------- who may use it
def test_not_signed_in_gets_401(client, accounts):
    assert client.get("/users").status_code == 401


def test_staff_get_403(client, accounts):
    client.post(
        "/auth/login",
        json={"email": "abebe@hospital.et", "password": PASSWORD},
    )
    assert client.get("/users").status_code == 403
    assert invite(client, accounts).status_code == 403


# ---------------------------------------------------------------- invite
def test_manager_invites_a_nurse(manager_client, accounts, emails):
    response = invite(manager_client, accounts)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "invited" and body["full_name"] is None
    assert "invitation_token_hash" not in body
    assert len(emails) == 1


def test_manager_cannot_invite_a_manager(manager_client, accounts):
    assert invite(manager_client, accounts, role="health_manager").status_code == 422


def test_duplicate_email_gets_409(manager_client, accounts):
    assert (
        invite(manager_client, accounts, email="tigist@hospital.et").status_code == 409
    )


def test_bad_email_gets_422(manager_client, accounts):
    assert invite(manager_client, accounts, email="not-an-email").status_code == 422


def test_failed_email_saves_nothing(manager_client, accounts, db, monkeypatch):
    from services import email_service
    from services.email_service import EmailError

    def broken(*args, **kwargs):
        raise EmailError

    monkeypatch.setattr(email_service, "send_invitation_email", broken)
    assert invite(manager_client, accounts).status_code == 503
    assert (
        db.scalars(select(User).where(User.email == "selam@hospital.et")).first()
        is None
    )


# ---------------------------------------------------------------- list, update, resend, revoke
def test_list_shows_staff_with_status(manager_client, accounts):
    invite(manager_client, accounts)
    users = manager_client.get("/users").json()
    statuses = {user["email"]: user["status"] for user in users}
    assert statuses["tigist@hospital.et"] == "active"
    assert statuses["selam@hospital.et"] == "invited"


def test_list_filtered_by_role(manager_client, accounts):
    users = manager_client.get("/users", params={"role": "biomedical_engineer"}).json()
    assert [user["email"] for user in users] == ["abebe@hospital.et"]


def test_change_role(manager_client, accounts):
    nurse_id = accounts["nurse"].user_id
    response = manager_client.patch(
        f"/users/{nurse_id}", json={"role": "biomedical_engineer"}
    )
    assert response.status_code == 200
    assert response.json()["role"] == "biomedical_engineer"


def test_empty_update_gets_422(manager_client, accounts):
    assert (
        manager_client.patch(f"/users/{accounts['nurse'].user_id}", json={}).status_code
        == 422
    )


def test_manager_cannot_edit_own_account(manager_client, accounts):
    manager_id = accounts["manager"].user_id
    response = manager_client.patch(
        f"/users/{manager_id}", json={"role": "clinical_staff"}
    )
    assert response.status_code == 404


def test_resend_invite(manager_client, accounts, emails):
    user_id = invite(manager_client, accounts).json()["user_id"]
    response = manager_client.post(f"/users/{user_id}/resend-invite")
    assert response.status_code == 200
    assert len(emails) == 2


def test_resend_to_active_user_gets_409(manager_client, accounts):
    response = manager_client.post(f"/users/{accounts['nurse'].user_id}/resend-invite")
    assert response.status_code == 409


def test_revoke(manager_client, accounts):
    response = manager_client.post(f"/users/{accounts['engineer'].user_id}/revoke")
    assert response.status_code == 200
    assert response.json()["status"] == "revoked"


# ---------------------------------------------------------------- accept invitation (public)
def test_full_invitation_flow(manager_client, accounts, emails):
    invite(manager_client, accounts)
    manager_client.post("/auth/logout")
    token = token_from(emails[0])

    response = manager_client.post(
        "/auth/accept-invite",
        json={
            "token": token,
            "full_name": "Selam Tesfaye",
            "password": NEW_PASSWORD,
            "confirm_password": NEW_PASSWORD,
        },
    )
    assert response.status_code == 200

    login = manager_client.post(
        "/auth/login",
        json={"email": "selam@hospital.et", "password": NEW_PASSWORD},
    )
    assert login.status_code == 200
    assert login.json()["full_name"] == "Selam Tesfaye"


def test_accept_with_bad_token_gets_400(client, accounts):
    response = client.post(
        "/auth/accept-invite",
        json={
            "token": "made-up-token-that-is-long",
            "full_name": "Selam Tesfaye",
            "password": NEW_PASSWORD,
            "confirm_password": NEW_PASSWORD,
        },
    )
    assert response.status_code == 400


def test_accept_with_weak_password_gets_422(manager_client, accounts, emails):
    invite(manager_client, accounts)
    response = manager_client.post(
        "/auth/accept-invite",
        json={
            "token": token_from(emails[0]),
            "full_name": "Selam Tesfaye",
            "password": "short",
            "confirm_password": "short",
        },
    )
    assert response.status_code == 422
