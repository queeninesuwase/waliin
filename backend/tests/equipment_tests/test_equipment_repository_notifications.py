from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from models.enums import NotificationType
from repositories.equipment import EquipmentRepository


def make_repository():
    db = MagicMock()
    repo = EquipmentRepository(db)
    equipment = SimpleNamespace(
        equipment_id=uuid4(),
        registered_by=uuid4(),
        registration_status="pending",
    )
    return repo, db, equipment


def test_apply_return_creates_notification_with_reason():
    repo, db, equipment = make_repository()
    reason = "Missing supporting documentation"

    result = repo.apply_return(equipment, reason=reason)

    assert result is equipment
    assert equipment.registration_status == "returned"
    db.add.assert_called_once()
    notification = db.add.call_args.args[0]
    assert notification.recipient_user_id == equipment.registered_by
    assert notification.related_equipment_id == equipment.equipment_id
    assert notification.notification_type == NotificationType.REGISTRATION_DECIDED.value
    assert notification.message == (
        "Your equipment registration was returned. Reason: Missing supporting documentation"
    )
    assert notification.channel == "in_app"
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(equipment)


def test_apply_return_without_reason_creates_notification():
    repo, db, equipment = make_repository()

    repo.apply_return(equipment)

    notification = db.add.call_args.args[0]
    assert notification.message == "Your equipment registration was returned."


def test_apply_return_rolls_back_on_commit_error():
    repo, db, equipment = make_repository()
    db.commit.side_effect = RuntimeError("database error")

    with pytest.raises(RuntimeError, match="database error"):
        repo.apply_return(equipment, reason="Missing documentation")

    db.rollback.assert_called_once()
    assert equipment.registration_status == "returned"
