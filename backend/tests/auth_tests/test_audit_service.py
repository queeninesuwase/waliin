"""Tests for services/audit_service.py."""

import pytest
from sqlalchemy import select

from models import AuditLog
from services.audit_service import log_action


def test_log_action_saves_who_what_and_when(db, data):
    log_action(
        db,
        data["manager"].user_id,
        "user_invited",
        "user",
        data["nurse"].user_id,
        {"role": "clinical_staff"},
    )
    row = db.scalars(select(AuditLog)).one()
    assert row.actor_user_id == data["manager"].user_id
    assert row.action == "user_invited"
    assert row.entity_type == "user"
    assert row.entity_id == data["nurse"].user_id
    assert row.details == {"role": "clinical_staff"}
    assert row.occurred_at is not None


def test_unknown_entity_type_is_refused(db, data):
    with pytest.raises(ValueError):
        log_action(db, data["manager"].user_id, "something", "spaceship")
