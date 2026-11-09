from datetime import datetime, timezone
from models import ResourceRequest

NOW = datetime.now(timezone.utc)


def new_request(data, **kw):
    values = dict(
        requested_by=data["engineer"].user_id,
        related_fault_id=data["fault"].fault_id,
        request_type="spare_parts",
        justification="Probe cable needed",
    )
    values.update(kw)
    return ResourceRequest(**values)


def test_request_constraints(checks, foreign_keys):
    assert {
        "resource_requests_request_type_check",
        "resource_requests_status_check",
        "ck_request_decided",
        "ck_request_resolved",
    } <= checks("resource_requests")
    assert foreign_keys("resource_requests")["fk_request_decider"] == [
        "users.user_id",
        "users.role",
    ]


def test_json_columns_were_replaced_by_tables(table):
    cols = set(table("resource_requests").c.keys())
    assert "items_json" not in cols and "external_follow_ups_json" not in cols


def test_new_request_is_pending(db, data):
    req = new_request(data)
    db.add(req)
    db.flush()
    db.refresh(req)
    assert req.status == "pending"
    assert req in data["fault"].resource_requests


def test_new_equipment_request_has_no_fault(db, data):
    db.add(
        new_request(
            data,
            related_fault_id=None,
            request_type="new_equipment",
            requested_by=data["nurse"].user_id,
        )
    )
    db.flush()


def test_manager_decides(db, data):
    req = new_request(
        data, status="approved", decision_by=data["manager"].user_id, decided_at=NOW
    )
    db.add(req)
    db.flush()


def test_decision_without_who_and_when_is_refused(db, data, refused):
    assert refused(lambda: db.add(new_request(data, status="approved")))


def test_engineer_cannot_decide(db, data, refused):
    assert refused(
        lambda: db.add(
            new_request(
                data,
                status="approved",
                decision_by=data["engineer"].user_id,
                decided_at=NOW,
            )
        )
    )


def test_resolved_needs_resolved_at(db, data, refused):
    assert refused(
        lambda: db.add(
            new_request(
                data,
                status="resolved",
                decision_by=data["manager"].user_id,
                decided_at=NOW,
            )
        )
    )
