from models import FaultStatusHistory


def test_history_constraints(checks):
    assert {
        "fault_status_history_previous_status_check",
        "fault_status_history_new_status_check",
        "ck_history_changed",
    } <= checks("fault_status_history")


def test_status_change_is_recorded(db, data):
    row = FaultStatusHistory(
        fault_id=data["fault"].fault_id,
        previous_status="assigned",
        new_status="under_repair",
        changed_by=data["engineer"].user_id,
        reason="Started",
    )
    db.add(row)
    db.flush()
    assert row in data["fault"].status_history


def test_first_event_has_no_previous_status(db, data):
    db.add(FaultStatusHistory(fault_id=data["fault"].fault_id, new_status="reported"))
    db.flush()


def test_same_old_and_new_status_is_refused(db, data, refused):
    assert refused(
        lambda: db.add(
            FaultStatusHistory(
                fault_id=data["fault"].fault_id,
                previous_status="assigned",
                new_status="assigned",
            )
        )
    )


def test_bad_status_is_refused(db, data, refused):
    assert refused(
        lambda: db.add(
            FaultStatusHistory(fault_id=data["fault"].fault_id, new_status="fixed")
        )
    )
