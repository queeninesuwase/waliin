import pytest
from argon2 import PasswordHasher

from services import auth_service
from services.auth_service import InvalidCredentialsError

PASSWORD = "maternity ward monitor"


def test_email_is_trimmed_and_lower_case():
    assert auth_service.normalize_email("  Abebe@Hospital.ET ") == "abebe@hospital.et"


def test_right_password_returns_the_user(db, accounts):
    user = auth_service.authenticate(db, "abebe@hospital.et", PASSWORD)
    assert user.user_id == accounts["engineer"].user_id


def test_wrong_password_is_refused(db, accounts):
    with pytest.raises(InvalidCredentialsError):
        auth_service.authenticate(db, "abebe@hospital.et", "wrong password here")


def test_unknown_email_is_refused(db, accounts):
    with pytest.raises(InvalidCredentialsError):
        auth_service.authenticate(db, "nobody@hospital.et", PASSWORD)


def test_deactivated_user_is_refused(db, accounts):
    accounts["nurse"].is_active = False
    db.flush()
    with pytest.raises(InvalidCredentialsError):
        auth_service.authenticate(db, "tigist@hospital.et", PASSWORD)


def test_old_weak_hash_is_upgraded_at_sign_in(db, accounts):
    weak = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1).hash(PASSWORD)
    accounts["nurse"].password_hash = weak
    db.flush()
    user = auth_service.authenticate(db, "tigist@hospital.et", PASSWORD)
    assert user.password_hash.startswith("$argon2id$v=19$m=65536,t=3,p=4$")
