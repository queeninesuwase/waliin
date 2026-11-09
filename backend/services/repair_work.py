from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from repositories import repair_work as repository


def add_repair(db: Session, fault_id: UUID, performed_by: UUID, payload):
    fault = repository.get_fault(db, fault_id)

    if fault is None:
        raise HTTPException(status_code=404, detail="Fault not found")

    if not payload.work_performed or not payload.work_performed.strip():
        raise HTTPException(
            status_code=400,
            detail="A repair needs a work description.",
        )

    rec = repository.create_repair_record(
        db, fault_id, fault.equipment_id, performed_by, payload
    )

    fault.assigned_engineer_id = performed_by
    fault.status = "under_repair"

    return rec


def add_test(db: Session, fault_id: UUID, performed_by: UUID, payload):
    fault = repository.get_fault(db, fault_id)

    if fault is None:
        raise HTTPException(status_code=404, detail="Fault not found")

    allowed_types = {
        "functional_test",
        "safety_test",
        "calibration",
        "performance_test",
        "commissioning",
    }

    if payload.record_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid test type.")

    if payload.test_result not in {"pass", "fail"}:
        raise HTTPException(
            status_code=400,
            detail="Test result must be 'pass' or 'fail'.",
        )

    rec = repository.create_test_record(db, fault_id, performed_by, payload)

    fault.assigned_engineer_id = performed_by
    fault.status = "awaiting_verification"

    return rec


def release_fault(db: Session, fault_id: UUID, performed_by: UUID, payload):
    fault = repository.get_fault(db, fault_id)

    if fault is None:
        raise HTTPException(status_code=404, detail="Fault not found")

    if fault.status == "released":
        raise HTTPException(
            status_code=409,
            detail="This fault has already been released.",
        )

    latest_functional = repository.get_latest_test(db, fault_id, "functional_test")
    latest_safety = repository.get_latest_test(db, fault_id, "safety_test")

    if not latest_functional or latest_functional.test_result != "pass":
        raise HTTPException(
            status_code=400,
            detail="The latest functional test must have passed.",
        )

    if not latest_safety or latest_safety.test_result != "pass":
        raise HTTPException(
            status_code=400,
            detail="The latest safety test must have passed.",
        )

    rec = repository.create_release_record(db, fault_id, performed_by, payload)

    fault.status = "released"
    # Fault model constraint requires closed_at to remain NULL here.
    fault.closed_at = None

    return rec


def get_records(db: Session, fault_id: UUID):
    if repository.get_fault(db, fault_id) is None:
        raise HTTPException(status_code=404, detail="Fault not found")

    return repository.get_records(db, fault_id)
