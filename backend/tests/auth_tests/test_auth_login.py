import pytest

from security.login_limiter import login_limiter
from services import auth_service
from services.auth_service import (
    InvalidCredentialsError,
    TooManyAttemptsError,
)

PASSWORD = "maternity ward monitor"
IP = "10.0.0.1"


@pytest.fixture(autouse=True)
def fresh_limiter():
    login_limiter.clear()
    yield
    login_limiter.clear()


def test_login_returns_the_user_and_a_session_token(db, accounts):
    user, raw_token = auth_service.login(db, "tigist@hospital.et", PASSWORD, IP)
    assert user.user_id == accounts["nurse"].user_id
    assert raw_token


def test_wrong_password_is_counted(db, accounts):
    for _ in range(5):
        with pytest.raises(InvalidCredentialsError):
            auth_service.login(db, "tigist@hospital.et", "wrong password here", IP)
    assert login_limiter.is_blocked("tigist@hospital.et", IP)


def test_blocked_login_is_refused_even_with_the_right_password(db, accounts):
    for _ in range(5):
        login_limiter.record_failure("tigist@hospital.et", IP)
    with pytest.raises(TooManyAttemptsError):
        auth_service.login(db, "tigist@hospital.et", PASSWORD, IP)


def test_success_resets_the_failures(db, accounts):
    for _ in range(4):
        login_limiter.record_failure("tigist@hospital.et", IP)
    auth_service.login(db, "tigist@hospital.et", PASSWORD, IP)
    login_limiter.record_failure("tigist@hospital.et", IP)
    assert not login_limiter.is_blocked("tigist@hospital.et", IP)
