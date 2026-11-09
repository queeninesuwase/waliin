from datetime import datetime, timedelta, timezone

from models import RepairVerificationRecord

NOW = datetime.now(timezone.utc)


def new_record(data, record_type, **kw):
    return RepairVerificationRecord(
        fault_id=data["fault"].fault_id,
        equipment_id=data["machine"].equipment_id,
        record_type=record_type,
        performed_by=data["engineer"].user_id,
        **kw,
    )


def passed_tests(db, data):
    earlier = NOW - timedelta(hours=1)
    db.add_all(
        [
            new_record(
                data, "functional_test", test_result="pass", performed_at=earlier
            ),
            new_record(data, "safety_test", test_result="pass", performed_at=earlier),
        ]
    )
    db.flush()


def test_record_constraints(checks, foreign_keys, table):
    assert {
        "ck_record_release_pair",
        "ck_record_release_type",
        "ck_record_test_result",
        "ck_record_repair_work",
        "ck_record_repair_dates",
    } <= checks("repair_verification_records")
    fks = foreign_keys("repair_verification_records")
    assert fks["fk_record_fault_equipment"] == [
        "faults.fault_id",
        "faults.equipment_id",
    ]
    assert fks["fk_record_engineer"] == ["users.user_id", "users.role"]
    assert {i.name: i.unique for i in table("repair_verification_records").indexes}[
        "uq_record_one_release"
    ]


def test_repair_needs_a_description(db, data, refused):
    assert refused(lambda: db.add(new_record(data, "repair")))


def test_test_record_needs_pass_or_fail(db, data, refused):
    assert refused(lambda: db.add(new_record(data, "safety_test")))


def test_record_must_name_the_faults_machine(db, data, refused):
    other = data["machine"].equipment_id.__class__(
        int=0
    )  # an id that is not the fault's machine
    assert refused(
        lambda: db.add(
            RepairVerificationRecord(
                fault_id=data["fault"].fault_id,
                equipment_id=other,
                record_type="repair",
                performed_by=data["engineer"].user_id,
                work_performed="x",
            )
        )
    )


def test_release_without_passed_tests_is_refused(db, data, refused):
    assert refused(
        lambda: db.add(
            new_record(data, "release", authorized_for_service=True, released_at=NOW)
        )
    )


def test_release_while_latest_safety_test_failed_is_refused(db, data, refused):
    passed_tests(db, data)
    db.add(
        new_record(
            data,
            "safety_test",
            test_result="fail",
            performed_at=NOW - timedelta(minutes=30),
        )
    )
    db.flush()
    assert refused(
        lambda: db.add(
            new_record(data, "release", authorized_for_service=True, released_at=NOW)
        )
    )


def test_release_after_both_tests_pass(db, data):
    passed_tests(db, data)
    db.add(new_record(data, "release", authorized_for_service=True, released_at=NOW))
    db.flush()


def test_only_a_release_record_can_authorise_service(db, data, refused):
    assert refused(
        lambda: db.add(
            new_record(
                data,
                "repair",
                work_performed="x",
                authorized_for_service=True,
                released_at=NOW,
            )
        )
    )


def test_second_release_is_refused(db, data, refused):
    passed_tests(db, data)
    db.add(new_record(data, "release", authorized_for_service=True, released_at=NOW))
    db.flush()
    assert refused(
        lambda: db.add(
            new_record(data, "release", authorized_for_service=True, released_at=NOW)
        )
    )


def test_nurse_cannot_record_a_repair(db, data, refused):
    assert refused(
        lambda: db.add(
            RepairVerificationRecord(
                fault_id=data["fault"].fault_id,
                equipment_id=data["machine"].equipment_id,
                record_type="repair",
                performed_by=data["nurse"].user_id,
                work_performed="x",
            )
        )
    )
