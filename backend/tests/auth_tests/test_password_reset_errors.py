import pytest

from models import User, UserRole
from security.login_limiter import reset_limiter
from services import password_reset_service
from services.password_reset_service import (
    InvalidResetLinkError,
    ResetNotAllowedError,
    TooManyResetRequestsError,
)

IP = "10.0.0.1"


@pytest.fixture(autouse=True)
def fresh_limiter():
    reset_limiter.clear()
    yield
    reset_limiter.clear()


def test_errors_carry_their_http_status():
    assert InvalidResetLinkError().status_code == 400
    assert ResetNotAllowedError().status_code == 409
    assert TooManyResetRequestsError().status_code == 429


def test_forgot_password_is_limited(db, accounts, emails):
    for _ in range(5):
        password_reset_service.forgot_password(db, "tigist@hospital.et", IP)
    with pytest.raises(TooManyResetRequestsError):
        password_reset_service.forgot_password(db, "tigist@hospital.et", IP)


def test_manager_cannot_send_a_link_to_an_invited_user(db, accounts, emails):
    invited = User(
        email="new@hospital.et",
        role=UserRole.CLINICAL_STAFF,
        department=accounts["dept"],
    )
    db.add(invited)
    db.flush()
    with pytest.raises(ResetNotAllowedError):
        password_reset_service.send_reset_link(db, accounts["manager"], invited)
    assert emails == []


def test_unknown_reset_link_is_refused(db, accounts):
    with pytest.raises(InvalidResetLinkError):
        password_reset_service.reset_password(
            db, "x" * 43, "maternity ward monitor 2", "maternity ward monitor 2"
        )
