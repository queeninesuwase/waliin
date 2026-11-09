from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from models import UserRole


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class CurrentUser(BaseModel):
    """What the apps may know about the signed-in user. Never the password hash or tokens."""

    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    full_name: str | None
    email: str
    role: UserRole
    department_id: UUID | None
    next_step: str = "done"


class AcceptInviteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=20, max_length=200)
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=128)
    confirm_password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=255)


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The token from the reset link.
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=1, max_length=128)
    confirm_password: str = Field(min_length=1, max_length=128)


class MfaCodeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=6, max_length=100)
