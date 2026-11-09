from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserRole
from schemas.users import InviteUserRequest, UpdateUserRequest, UserOut
from security.dependencies import require_role
from services import invitation_service, password_reset_service, user_service

router = APIRouter(prefix="/users", tags=["users"])

Db = Annotated[Session, Depends(get_db)]
Manager = Annotated[User, Depends(require_role(UserRole.HEALTH_MANAGER))]


def to_user_out(user):
    return UserOut(
        user_id=user.user_id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        department_id=user.department_id,
        status=user_service.user_status(user),
        invitation_expires_at=user.invitation_expires_at,
        created_at=user.created_at,
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def invite_user(body: InviteUserRequest, manager: Manager, db: Db):
    user = invitation_service.invite_user(
        db, manager, body.email, body.role, body.department_id
    )
    return to_user_out(user)


@router.get("", response_model=list[UserOut])
def list_users(
    manager: Manager,
    db: Db,
    role: UserRole | None = None,
    department_id: UUID | None = None,
):
    users = user_service.list_users(db, role, department_id)
    return [to_user_out(user) for user in users]


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: UUID, body: UpdateUserRequest, manager: Manager, db: Db):
    user = user_service.get_managed_user(db, user_id)
    user = user_service.update_user(db, manager, user, body.role, body.department_id)
    return to_user_out(user)


@router.post("/{user_id}/resend-invite", response_model=UserOut)
def resend_invite(user_id: UUID, manager: Manager, db: Db):
    user = user_service.get_managed_user(db, user_id)
    user = invitation_service.resend_invitation(db, manager, user)
    return to_user_out(user)


@router.post("/{user_id}/revoke", response_model=UserOut)
def revoke_user(user_id: UUID, manager: Manager, db: Db):
    user = user_service.get_managed_user(db, user_id)
    user = user_service.revoke_user(db, manager, user)
    return to_user_out(user)


@router.post("/{user_id}/send-reset-link", status_code=status.HTTP_202_ACCEPTED)
def send_reset_link(user_id: UUID, manager: Manager, db: Db):
    user = user_service.get_managed_user(db, user_id)
    password_reset_service.send_reset_link(db, manager, user)
    return {"message": "A reset link has been emailed to the user."}
