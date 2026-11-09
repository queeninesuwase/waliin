"""Tests for the user repository and for rollback behaviour."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from models import AuditLog
from repositories import user_repository
from services import email_service, password_reset_service
from services.audit_service import log_action


def test_inactive_department_is_not_returned(db, data):
    department_id = data["dept"].department_id
    assert user_repository.get_active_department(db, department_id) is not None
    data["dept"].is_active = False
    db.flush()
    assert user_repository.get_active_department(db, department_id) is None


def test_unknown_department_is_not_returned(db, data):
    import uuid

    assert user_repository.get_active_department(db, uuid.uuid4()) is None


def test_lookup_by_reset_hash(db, data):
    data["nurse"].reset_token_hash = "some-hash"
    data["nurse"].reset_token_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=15
    )
    user_repository.save_user(db, data["nurse"])
    assert user_repository.get_user_by_reset_hash(db, "some-hash") is data["nurse"]
    assert user_repository.get_user_by_reset_hash(db, "other-hash") is None


def test_rollback_discards_an_uncommitted_audit_row(db, data):
    log_action(db, data["manager"].user_id, "rollback_probe", "user", None)
    user_repository.rollback(db)
    rows = db.scalars(select(AuditLog).where(AuditLog.action == "rollback_probe")).all()
    assert rows == []


def test_failed_reset_email_leaves_no_audit_row(db, accounts, monkeypatch):
    def broken(*args, **kwargs):
        raise email_service.EmailError

    monkeypatch.setattr(email_service, "send_password_reset_email", broken)
    password_reset_service.request_reset(db, "tigist@hospital.et")
    rows = db.scalars(
        select(AuditLog).where(AuditLog.action == "password_reset_requested")
    ).all()
    assert rows == []
