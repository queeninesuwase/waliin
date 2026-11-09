from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from models import UserRole

InvitableRole = Literal["clinical_staff", "biomedical_engineer"]
UserStatus = Literal["active", "invited", "invite_expired", "revoked"]

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class InviteUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=255, pattern=EMAIL_PATTERN)
    role: InvitableRole
    department_id: UUID


class UpdateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: InvitableRole | None = None
    department_id: UUID | None = None

    @model_validator(mode="after")
    def at_least_one_change(self):
        if self.role is None and self.department_id is None:
            raise ValueError("Send a role, a department_id, or both.")
        return self


class UserOut(BaseModel):
    """What the dashboard shows about a user. Never the password hash or tokens."""

    user_id: UUID
    full_name: str | None
    email: str
    role: UserRole
    department_id: UUID | None
    status: UserStatus
    invitation_expires_at: datetime | None
    created_at: datetime
