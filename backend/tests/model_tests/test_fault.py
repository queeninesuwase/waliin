import uuid
from datetime import datetime, timezone

from models import Fault

NOW = datetime.now(timezone.utc)


def new_fault(data, **kw):
    values = dict(
        equipment_id=data["machine"].equipment_id,
        reported_by=data["nurse"].user_id,
        description="Alarm keeps sounding",
        severity="medium",
    )
    values.update(kw)
    return Fault(**values)


def test_fault_constraints(checks, uniques, foreign_keys):
    assert {"faults_client_report_id_key", "uq_fault_equipment"} <= uniques("faults")
    assert {
        "faults_severity_check",
        "faults_status_check",
        "ck_fault_closed_at",
        "ck_fault_assigned",
    } <= checks("faults")
    assert foreign_keys("faults")["fk_fault_engineer"] == [
        "users.user_id",
        "users.role",
    ]


def test_new_fault_is_reported(db, data):
    f = new_fault(data)
    db.add(f)
    db.flush()
    db.refresh(f)
    assert f.status == "reported" and f.reported_at is not None


def test_same_offline_report_is_saved_only_once(db, data, refused):
    rid = uuid.uuid4()
    db.add(new_fault(data, client_report_id=rid))
    db.flush()
    assert refused(lambda: db.add(new_fault(data, client_report_id=rid)))


def test_fault_past_reported_needs_an_engineer(db, data, refused):
    assert refused(lambda: db.add(new_fault(data, status="under_repair")))


def test_nurse_cannot_be_assigned(data, refused):
    assert refused(
        lambda: setattr(data["fault"], "assigned_engineer_id", data["nurse"].user_id)
    )


def test_bad_status_is_refused(db, data, refused):
    assert refused(lambda: db.add(new_fault(data, status="fixed")))


def test_closed_fault_needs_closed_at(db, data, refused):
    assert refused(lambda: setattr(data["fault"], "status", "closed"))


def test_closed_fault_with_closed_at_is_allowed(db, data):
    data["fault"].status = "closed"
    data["fault"].closed_at = NOW
    db.flush()
