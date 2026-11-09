from models import AuditLog


def test_audit_log_columns(table, checks):
    assert set(table("audit_logs").c.keys()) == {
        "audit_id",
        "actor_user_id",
        "action",
        "entity_type",
        "entity_id",
        "details",
        "occurred_at",
    }
    assert "audit_logs_entity_type_check" in checks("audit_logs")


def test_audit_row_is_saved(db, data):
    row = AuditLog(
        actor_user_id=data["manager"].user_id,
        action="equipment_approved",
        entity_type="equipment",
        entity_id=data["machine"].equipment_id,
        details={"asset_tag": "WAL-000001"},
    )
    db.add(row)
    db.flush()
    assert row in data["manager"].audit_logs


def test_system_event_has_no_actor(db, data):
    db.add(
        AuditLog(
            action="login_blocked",
            entity_type="user",
            details={"email": "x@hospital.et"},
        )
    )
    db.flush()


def test_bad_entity_type_is_refused(db, data, refused):
    assert refused(lambda: db.add(AuditLog(action="x", entity_type="patient")))
