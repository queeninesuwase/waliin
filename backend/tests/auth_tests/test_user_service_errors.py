import pytest

from services.errors import ServiceError
from services.invitation_service import InvalidInvitationError, InvitationEmailError
from services.user_service import (
    AccountRevokedError,
    DuplicateEmailError,
    InvalidUserDetailsError,
    InvitationAlreadyAcceptedError,
    RoleChangeBlockedError,
    UnknownDepartmentError,
    UserNotFoundError,
)

ERRORS = {
    UserNotFoundError: 404,
    DuplicateEmailError: 409,
    UnknownDepartmentError: 422,
    InvitationAlreadyAcceptedError: 409,
    AccountRevokedError: 409,
    RoleChangeBlockedError: 409,
    InvalidUserDetailsError: 422,
    InvalidInvitationError: 400,
    InvitationEmailError: 503,
}


@pytest.mark.parametrize("error, code", ERRORS.items())
def test_each_error_carries_its_http_status(error, code):
    assert issubclass(error, ServiceError)
    assert error().status_code == code
    assert error().message


def test_invalid_details_is_still_a_value_error():
    assert issubclass(InvalidUserDetailsError, ValueError)
    assert InvalidUserDetailsError("Full name is required.").message == (
        "Full name is required."
    )
