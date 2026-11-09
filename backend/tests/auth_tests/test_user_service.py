"""Tests for services/user_service.py: status, update and revoke."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from models import AuditLog, Department, User, UserRole
from services import session_service, user_service
from services.user_service import (
    AccountRevokedError,
    UnknownDepartmentError,
    UserNotFoundError,
)

NOW = datetime.now(timezone.utc)


def test_status_of_each_kind_of_user(db, data):
    assert user_service.user_status(data["nurse"]) == "active"
    invited = User(
        email="new@hospital.et",
        role=UserRole.CLINICAL_STAFF,
        department=data["dept"],
        is_active=True,
        invitation_expires_at=NOW + timedelta(hours=1),
    )
    assert user_service.user_status(invited, now=NOW) == "invited"
    assert (
        user_service.user_status(invited, now=NOW + timedelta(hours=2))
        == "invite_expired"
    )
    invited.is_active = False
    assert user_service.user_status(invited) == "revoked"


def test_manager_cannot_be_managed(db, data):
    with pytest.raises(UserNotFoundError):
        user_service.get_managed_user(db, data["manager"].user_id)


def test_change_department(db, data):
    pediatrics = Department(department_name="Pediatrics")
    db.add(pediatrics)
    db.flush()
    user_service.update_user(
        db, data["manager"], data["nurse"], department_id=pediatrics.department_id
    )
    assert data["nurse"].department_id == pediatrics.department_id
    row = db.scalars(select(AuditLog).where(AuditLog.action == "user_updated")).one()
    assert "department_id" in row.details


def test_unknown_department_is_refused(db, data):
    import uuid

    with pytest.raises(UnknownDepartmentError):
        user_service.update_user(
            db, data["manager"], data["nurse"], department_id=uuid.uuid4()
        )


def test_role_change_signs_the_user_out(db, data):
    nurse = data["nurse"]
    raw_token = session_service.start_session(db, nurse.user_id)
    user_service.update_user(db, data["manager"], nurse, role="biomedical_engineer")
    assert UserRole(nurse.role) == UserRole.BIOMEDICAL_ENGINEER
    assert session_service.get_active_session(db, raw_token) is None


def test_revoke_ends_access_and_sessions(db, data):
    engineer = data["engineer"]
    raw_token = session_service.start_session(db, engineer.user_id)
    user_service.revoke_user(db, data["manager"], engineer)
    assert engineer.is_active is False
    assert session_service.get_active_session(db, raw_token) is None
    assert db.scalars(
        select(AuditLog).where(AuditLog.action == "user_deactivated")
    ).one()


def test_revoke_twice_is_refused(db, data):
    user_service.revoke_user(db, data["manager"], data["nurse"])
    with pytest.raises(AccountRevokedError):
        user_service.revoke_user(db, data["manager"], data["nurse"])
