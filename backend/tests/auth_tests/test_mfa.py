from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from config import settings
from models import AuditLog
from security.encryption import new_key
from security.totp import code_at, time_step
from services import mfa_service
from services.mfa_service import (
    InvalidMfaCodeError,
    MfaAlreadyEnabledError,
    MfaNotSetUpError,
)

PASSWORD = "maternity ward monitor"  # same as in conftest.py


@pytest.fixture(autouse=True)
def mfa_key(monkeypatch):
    monkeypatch.setattr(settings, "mfa_encryption_key", new_key())


def current_code(secret, now=None):
    now = now or datetime.now(timezone.utc)
    return code_at(secret, time_step(now.timestamp()))


def set_up_mfa(db, user):
    """Turn MFA on for a user and return the authenticator secret."""
    secret, _ = mfa_service.start_setup(db, user)
    mfa_service.confirm_setup(db, user, current_code(secret))
    return secret


def test_manager_and_engineer_need_mfa(accounts):
    assert mfa_service.mfa_required(accounts["manager"])
    assert mfa_service.mfa_required(accounts["engineer"])


def test_nurse_does_not_need_mfa(accounts):
    assert not mfa_service.mfa_required(accounts["nurse"])
    assert mfa_service.next_step(accounts["nurse"]) == "done"


def test_next_step_is_setup_then_verify(db, accounts):
    engineer = accounts["engineer"]
    assert mfa_service.next_step(engineer) == "mfa_setup"
    set_up_mfa(db, engineer)
    assert mfa_service.next_step(engineer) == "mfa_verify"


def test_setup_stores_the_secret_encrypted(db, accounts):
    engineer = accounts["engineer"]
    secret, otpauth_url = mfa_service.start_setup(db, engineer)
    assert engineer.mfa_secret_encrypted is not None
    assert secret not in engineer.mfa_secret_encrypted
    assert otpauth_url.startswith("otpauth://totp/")
    assert not engineer.mfa_enabled


def test_confirm_turns_mfa_on(db, accounts):
    engineer = accounts["engineer"]
    secret, _ = mfa_service.start_setup(db, engineer)
    mfa_service.confirm_setup(db, engineer, current_code(secret))
    assert engineer.mfa_enabled
    actions = db.scalars(
        select(AuditLog.action).where(AuditLog.actor_user_id == engineer.user_id)
    ).all()
    assert "mfa_enabled" in actions


def test_confirm_with_wrong_code_keeps_mfa_off(db, accounts):
    engineer = accounts["engineer"]
    mfa_service.start_setup(db, engineer)
    with pytest.raises(InvalidMfaCodeError):
        mfa_service.confirm_setup(db, engineer, "000000")
    assert not engineer.mfa_enabled


def test_setup_twice_is_refused(db, accounts):
    engineer = accounts["engineer"]
    set_up_mfa(db, engineer)
    with pytest.raises(MfaAlreadyEnabledError):
        mfa_service.start_setup(db, engineer)


def test_correct_code_is_accepted(db, accounts):
    engineer = accounts["engineer"]
    secret = set_up_mfa(db, engineer)
    mfa_service.verify_code(db, engineer, current_code(secret))


def test_verify_without_setup_is_refused(db, accounts):
    with pytest.raises(MfaNotSetUpError):
        mfa_service.verify_code(db, accounts["engineer"], "123456")


def login(client, email):
    response = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200
    return response.json()


def test_nurse_login_is_done_at_once(client, accounts):
    assert login(client, "tigist@hospital.et")["next_step"] == "done"


def test_engineer_first_login_sets_up_the_app(client, accounts):
    assert login(client, "abebe@hospital.et")["next_step"] == "mfa_setup"
    # Signed in with the password only: /auth/me works, other endpoints do not.
    assert client.get("/auth/me").json()["next_step"] == "mfa_setup"

    setup = client.post("/auth/mfa/setup")
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    old_cookie = client.cookies.get(settings.session_cookie_name)

    confirm = client.post("/auth/mfa/confirm", json={"code": current_code(secret)})
    assert confirm.status_code == 200
    assert confirm.json()["next_step"] == "done"
    # A new session after MFA.
    assert client.cookies.get(settings.session_cookie_name) != old_cookie
    assert client.get("/auth/me").json()["next_step"] == "done"


def test_engineer_later_login_asks_for_code(client, db, accounts):
    secret = set_up_mfa(db, accounts["engineer"])
    assert login(client, "abebe@hospital.et")["next_step"] == "mfa_verify"

    wrong = client.post("/auth/mfa/verify", json={"code": "000000"})
    assert wrong.status_code == 400

    right = client.post("/auth/mfa/verify", json={"code": current_code(secret)})
    assert right.status_code == 200
    assert right.json()["next_step"] == "done"


def test_mfa_endpoints_need_a_session(client, accounts):
    assert client.post("/auth/mfa/setup").status_code == 401
    assert client.post("/auth/mfa/verify", json={"code": "123456"}).status_code == 401


def test_setup_again_after_mfa_is_on_gives_409(client, db, accounts):
    set_up_mfa(db, accounts["engineer"])
    login(client, "abebe@hospital.et")
    assert client.post("/auth/mfa/setup").status_code == 409


def test_secret_is_never_in_me(client, db, accounts):
    set_up_mfa(db, accounts["engineer"])
    login(client, "abebe@hospital.et")
    body = client.get("/auth/me").json()
    assert "mfa_secret_encrypted" not in body
