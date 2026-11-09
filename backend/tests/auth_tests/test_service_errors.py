from services.auth_service import (
    InvalidCredentialsError,
    TooManyAttemptsError,
)
from services.errors import ServiceError


def test_login_errors_carry_their_http_status():
    assert InvalidCredentialsError().status_code == 401
    assert TooManyAttemptsError().status_code == 429
    assert all(
        issubclass(error, ServiceError)
        for error in (InvalidCredentialsError, TooManyAttemptsError)
    )
