from fastapi import status
from sqlalchemy.exc import IntegrityError

from models import UserRole
from models.enums import AuditEntityType
from repositories import user_repository
from security.tokens import is_expired
from services import session_service
from services.audit_service import log_action
from services.errors import ServiceError

INVITABLE_ROLES = {UserRole.CLINICAL_STAFF, UserRole.BIOMEDICAL_ENGINEER}


class UserNotFoundError(ServiceError):
    status_code = status.HTTP_404_NOT_FOUND
    message = "User not found."


class DuplicateEmailError(ServiceError):
    status_code = status.HTTP_409_CONFLICT
    message = "A user with this email already exists."


class UnknownDepartmentError(ServiceError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    message = "Department not found."


class InvitationAlreadyAcceptedError(ServiceError):
    status_code = status.HTTP_409_CONFLICT
    message = "This user has already accepted the invitation."


class AccountRevokedError(ServiceError):
    status_code = status.HTTP_409_CONFLICT
    message = "This user's access is revoked."


class RoleChangeBlockedError(ServiceError):
    status_code = status.HTTP_409_CONFLICT
    message = (
        "The role cannot change while this user has work recorded "
        "under the current role."
    )


class InvalidUserDetailsError(ServiceError, ValueError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    message = "Check the details and try again."


def check_invitable_role(role):
    if UserRole(role) not in INVITABLE_ROLES:
        raise InvalidUserDetailsError(
            "Role must be clinical_staff or biomedical_engineer."
        )


def user_status(user, now=None):
    if not user.is_active:
        return "revoked"
    if user.invitation_accepted_at is not None:
        return "active"
    if is_expired(user.invitation_expires_at, now):
        return "invite_expired"
    return "invited"


def list_users(db, role=None, department_id=None):
    return user_repository.list_users(db, role=role, department_id=department_id)


def get_managed_user(db, user_id):
    user = user_repository.get_user_by_id(db, user_id)
    if user is None or UserRole(user.role) not in INVITABLE_ROLES:
        raise UserNotFoundError
    return user


def update_user(db, manager, user, role=None, department_id=None):
    # Check everything first, so a refused change leaves the user untouched.
    changes = {}
    if role is not None and UserRole(role) != UserRole(user.role):
        check_invitable_role(role)
        changes["role"] = {
            "old": UserRole(user.role).value,
            "new": UserRole(role).value,
        }
    if department_id is not None and department_id != user.department_id:
        if user_repository.get_active_department(db, department_id) is None:
            raise UnknownDepartmentError
        changes["department_id"] = {
            "old": str(user.department_id),
            "new": str(department_id),
        }
    if not changes:
        return user

    if "role" in changes:
        user.role = UserRole(role)
    if "department_id" in changes:
        user.department_id = department_id
    try:
        user_repository.save_user(db, user)
        log_action(
            db,
            manager.user_id,
            "user_updated",
            AuditEntityType.USER,
            user.user_id,
            changes,
        )
        if "role" in changes:
            session_service.end_all_sessions(db, user.user_id)
        user_repository.commit(db)
    except IntegrityError:
        user_repository.rollback(db)
        raise RoleChangeBlockedError from None
    return user


def revoke_user(db, manager, user):
    if not user.is_active:
        raise AccountRevokedError("This user's access is already revoked.")

    action = "user_deactivated" if user.invitation_accepted_at else "invite_revoked"
    user.is_active = False
    user.invitation_token_hash = None
    user.invitation_expires_at = None
    user_repository.save_user(db, user)
    log_action(db, manager.user_id, action, AuditEntityType.USER, user.user_id)
    session_service.end_all_sessions(db, user.user_id)
    user_repository.commit(db)
    return user
