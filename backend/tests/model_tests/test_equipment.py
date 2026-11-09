from datetime import datetime, timezone
from models import Equipment

NOW = datetime.now(timezone.utc)


def new_machine(data, **kw):
    values = dict(
        manufacturer="Mindray",
        model_name="BeneVision N12",
        equipment_category="patient monitor",
        department_id=data["dept"].department_id,
        asset_tag="WAL-000002",
        location="ICU",
        acquisition_type="purchased",
        registered_by=data["engineer"].user_id,
    )
    values.update(kw)
    return Equipment(**values)


def test_equipment_constraints(checks, uniques, foreign_keys):
    assert "equipment_asset_tag_key" in uniques("equipment")
    assert {
        "equipment_acquisition_type_check",
        "equipment_registration_status_check",
        "equipment_installation_status_check",
        "equipment_service_status_check",
        "ck_equipment_approval",
        "ck_equipment_warranty_dates",
    } <= checks("equipment")
    assert foreign_keys("equipment")["fk_equipment_approver"] == [
        "users.user_id",
        "users.role",
    ]


def test_new_equipment_is_pending(db, data):
    m = new_machine(data)
    db.add(m)
    db.flush()
    db.refresh(m)
    assert (m.registration_status, m.installation_status, m.service_status) == (
        "pending",
        "unknown",
        "not_assessed",
    )


def test_unknown_acquisition_type_is_allowed(db, data):
    db.add(new_machine(data, acquisition_type="unknown"))
    db.flush()


def test_bad_acquisition_type_is_refused(db, data, refused):
    assert refused(lambda: db.add(new_machine(data, acquisition_type="gift")))


def test_duplicate_asset_tag_is_refused(db, data, refused):
    assert refused(lambda: db.add(new_machine(data, asset_tag="WAL-000001")))


def test_approved_without_approver_is_refused(db, data, refused):
    assert refused(lambda: db.add(new_machine(data, registration_status="approved")))


def test_engineer_cannot_approve(db, data, refused):
    assert refused(
        lambda: db.add(
            new_machine(
                data,
                registration_status="approved",
                approved_by=data["engineer"].user_id,
                approved_at=NOW,
            )
        )
    )


def test_warranty_end_before_start_is_refused(db, data, refused):
    assert refused(
        lambda: db.add(
            new_machine(
                data,
                warranty_start_date=NOW.date(),
                warranty_end_date=NOW.date().replace(year=NOW.year - 1),
            )
        )
    )
