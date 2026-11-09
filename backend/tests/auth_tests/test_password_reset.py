import re
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from config import settings
from models import AuditLog
from security.passwords import verify_password
from security.tokens import hash_token
from services import password_reset_service, session_service
from services.password_reset_service import InvalidResetLinkError

PASSWORD = "maternity ward monitor"  # same as in conftest.py
NEW_PASSWORD = "new night shift password"
NOW = datetime.now(timezone.utc)


def text_of(email_message):
    return email_message.get_body(preferencelist=("plain",)).get_content()


def token_from(email_message):
    return re.search(r"/reset-password/([\w-]+)", text_of(email_message)).group(1)


def test_reset_link_is_emailed_and_only_its_hash_saved(db, accounts, emails):
    password_reset_service.request_reset(db, "Tigist@Hospital.et", now=NOW)
    nurse = accounts["nurse"]
    raw_token = token_from(emails[0])
    assert emails[0]["To"] == "tigist@hospital.et"
    assert nurse.reset_token_hash == hash_token(raw_token)
    assert nurse.reset_token_expires_at == NOW + timedelta(minutes=5)


def test_manager_link_opens_the_dashboard(db, accounts, emails, monkeypatch):
    monkeypatch.setattr(settings, "frontend_base_url", "https://app.example")
    monkeypatch.setattr(settings, "dashboard_base_url", "https://dashboard.example")
    password_reset_service.request_reset(db, "meron@hospital.et")
    password_reset_service.request_reset(db, "tigist@hospital.et")
    assert "https://dashboard.example/reset-password/" in text_of(emails[0])
    assert "https://app.example/reset-password/" in text_of(emails[1])


def test_unknown_email_sends_nothing(db, accounts, emails):
    password_reset_service.request_reset(db, "nobody@hospital.et")
    assert emails == []


def test_revoked_user_gets_no_link(db, accounts, emails):
    accounts["nurse"].is_active = False
    db.flush()
    password_reset_service.request_reset(db, "tigist@hospital.et")
    assert emails == []


def test_request_is_audited(db, accounts):
    password_reset_service.request_reset(db, "tigist@hospital.et")
    assert db.scalars(
        select(AuditLog).where(AuditLog.action == "password_reset_requested")
    ).one()


def test_reset_sets_the_new_password(db, accounts, emails):
    password_reset_service.request_reset(db, "tigist@hospital.et")
    user = password_reset_service.reset_password(
        db, token_from(emails[0]), NEW_PASSWORD, NEW_PASSWORD
    )
    assert verify_password(user.password_hash, NEW_PASSWORD)
    assert not verify_password(user.password_hash, PASSWORD)
    assert user.reset_token_hash is None and user.reset_token_expires_at is None


def test_reset_signs_out_everywhere(db, accounts, emails):
    nurse = accounts["nurse"]
    session_token = session_service.start_session(db, nurse.user_id)
    password_reset_service.request_reset(db, "tigist@hospital.et")
    password_reset_service.reset_password(
        db, token_from(emails[0]), NEW_PASSWORD, NEW_PASSWORD
    )
    assert session_service.get_active_session(db, session_token) is None
    assert nurse.token_version == 1


def test_link_works_only_once(db, accounts, emails):
    password_reset_service.request_reset(db, "tigist@hospital.et")
    raw_token = token_from(emails[0])
    password_reset_service.reset_password(db, raw_token, NEW_PASSWORD, NEW_PASSWORD)
    with pytest.raises(InvalidResetLinkError):
        password_reset_service.reset_password(db, raw_token, NEW_PASSWORD, NEW_PASSWORD)


def test_link_expires_after_5_minutes(db, accounts, emails):
    password_reset_service.request_reset(db, "tigist@hospital.et", now=NOW)
    with pytest.raises(InvalidResetLinkError):
        password_reset_service.reset_password(
            db,
            token_from(emails[0]),
            NEW_PASSWORD,
            NEW_PASSWORD,
            now=NOW + timedelta(minutes=5),
        )


def test_new_request_cancels_the_old_link(db, accounts, emails):
    password_reset_service.request_reset(db, "tigist@hospital.et")
    password_reset_service.request_reset(db, "tigist@hospital.et")
    with pytest.raises(InvalidResetLinkError):
        password_reset_service.reset_password(
            db, token_from(emails[0]), NEW_PASSWORD, NEW_PASSWORD
        )


def test_passwords_must_match(db, accounts, emails):
    password_reset_service.request_reset(db, "tigist@hospital.et")
    with pytest.raises(ValueError, match="do not match"):
        password_reset_service.reset_password(
            db, token_from(emails[0]), NEW_PASSWORD, "something else entirely"
        )


def test_weak_password_is_refused(db, accounts, emails):
    password_reset_service.request_reset(db, "tigist@hospital.et")
    with pytest.raises(ValueError):
        password_reset_service.reset_password(
            db, token_from(emails[0]), "short", "short"
        )


# ---------------------------------------------------------------- endpoints
def test_forgot_password_reply_is_the_same_for_any_email(client, accounts, emails):
    known = client.post("/auth/forgot-password", json={"email": "tigist@hospital.et"})
    unknown = client.post("/auth/forgot-password", json={"email": "nobody@hospital.et"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert len(emails) == 1


def test_forgot_password_is_rate_limited(client, accounts):
    for _ in range(5):
        client.post("/auth/forgot-password", json={"email": "tigist@hospital.et"})
    response = client.post(
        "/auth/forgot-password", json={"email": "tigist@hospital.et"}
    )
    assert response.status_code == 429


def test_full_reset_flow(client, accounts, emails):
    client.post("/auth/forgot-password", json={"email": "tigist@hospital.et"})
    response = client.post(
        "/auth/reset-password",
        json={
            "token": token_from(emails[0]),
            "password": NEW_PASSWORD,
            "confirm_password": NEW_PASSWORD,
        },
    )
    assert response.status_code == 200
    old = client.post(
        "/auth/login",
        json={"email": "tigist@hospital.et", "password": PASSWORD},
    )
    new = client.post(
        "/auth/login",
        json={"email": "tigist@hospital.et", "password": NEW_PASSWORD},
    )
    assert old.status_code == 401
    assert new.status_code == 200


def test_reset_with_bad_token_gets_400(client, accounts):
    response = client.post(
        "/auth/reset-password",
        json={
            "token": "made-up-token-that-is-long",
            "password": NEW_PASSWORD,
            "confirm_password": NEW_PASSWORD,
        },
    )
    assert response.status_code == 400


def test_manager_sends_a_reset_link(manager_client, accounts, emails):
    response = manager_client.post(
        f"/users/{accounts['nurse'].user_id}/send-reset-link"
    )
    assert response.status_code == 202
    assert emails[0]["To"] == "tigist@hospital.et"


def test_manager_reset_link_is_audited_with_the_manager(manager_client, db, accounts):
    manager_client.post(f"/users/{accounts['nurse'].user_id}/send-reset-link")
    row = db.scalars(
        select(AuditLog).where(AuditLog.action == "password_reset_requested")
    ).one()
    assert row.actor_user_id == accounts["manager"].user_id


def test_reset_link_for_invited_user_gets_409(manager_client, db, accounts):
    from models import User, UserRole

    invited = User(
        email="new@hospital.et",
        role=UserRole.CLINICAL_STAFF,
        department=accounts["dept"],
    )
    db.add(invited)
    db.flush()
    assert (
        manager_client.post(f"/users/{invited.user_id}/send-reset-link").status_code
        == 409
    )
