from services import mfa_service
from services.errors import ServiceError
from services.mfa_service import (
    InvalidMfaCodeError,
    MfaAlreadyEnabledError,
    MfaNotSetUpError,
)


def test_mfa_errors_carry_their_http_status():
    expected = {
        MfaAlreadyEnabledError: 409,
        MfaNotSetUpError: 409,
        InvalidMfaCodeError: 400,
    }
    for error, code in expected.items():
        assert issubclass(error, ServiceError)
        assert error().status_code == code


def test_sign_in_step(accounts):
    assert mfa_service.sign_in_step(accounts["nurse"], False) == "done"
    assert mfa_service.sign_in_step(accounts["engineer"], True) == "done"
    assert mfa_service.sign_in_step(accounts["engineer"], False) in (
        "mfa_setup",
        "mfa_verify",
    )
