from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import configure_mappers

from database import Base
from models import FaultDowntime, RepairVerificationRecord

NOW = datetime.now(timezone.utc)


def test_all_13_tables_are_registered_and_view_is_not_a_table():
    assert set(Base.metadata.tables) == {
        "users",
        "departments",
        "equipment",
        "equipment_documents",
        "faults",
        "fault_status_history",
        "fault_assessments",
        "repair_verification_records",
        "resource_requests",
        "request_items",
        "request_follow_ups",
        "notifications",
        "audit_logs",
    }
    assert "fault_downtime" not in Base.metadata.tables


def test_all_relationships_are_valid():

    configure_mappers()


def test_machine_still_down(db, data):
    row = db.get(FaultDowntime, data["fault"].fault_id)
    assert row.still_down is True and row.released_at is None
    assert row.downtime >= timedelta(days=3)


def test_downtime_ends_at_release(db, data):
    earlier = NOW - timedelta(hours=1)
    ids = dict(
        fault_id=data["fault"].fault_id,
        equipment_id=data["machine"].equipment_id,
        performed_by=data["engineer"].user_id,
    )
    db.add_all(
        [
            RepairVerificationRecord(
                record_type="functional_test",
                test_result="pass",
                performed_at=earlier,
                **ids,
            ),
            RepairVerificationRecord(
                record_type="safety_test",
                test_result="pass",
                performed_at=earlier,
                **ids,
            ),
        ]
    )
    db.flush()
    db.add(
        RepairVerificationRecord(
            record_type="release", authorized_for_service=True, released_at=NOW, **ids
        )
    )
    db.flush()
    row = db.get(FaultDowntime, data["fault"].fault_id)
    assert row.still_down is False and row.downtime.days == 3


def test_working_machine_is_not_in_the_view(db, data):
    from models import Fault

    f = Fault(
        equipment_id=data["machine"].equipment_id,
        reported_by=data["nurse"].user_id,
        description="Minor noise",
        severity="low",
    )  # can still be used: no out_of_service_at
    db.add(f)
    db.flush()
    assert db.get(FaultDowntime, f.fault_id) is None
