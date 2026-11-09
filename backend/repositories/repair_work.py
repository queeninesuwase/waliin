from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from models.fault import Fault
from models.repair_verification_record import RepairVerificationRecord


def get_fault(db, fault_id):
    return db.scalar(select(Fault).where(Fault.fault_id == fault_id))


def create_repair_record(
    db: Session,
    fault_id: UUID,
    equipment_id: UUID,
    performed_by: UUID,
    payload,
) -> RepairVerificationRecord:
    """Create a repair record within the caller's transaction."""
    record = RepairVerificationRecord(
        fault_id=fault_id,
        equipment_id=equipment_id,
        record_type="repair",
        performed_by=performed_by,
        performed_by_role="biomedical_engineer",
        work_performed=payload.work_performed,
        parts_used=payload.parts_used,
        repair_started_at=payload.repair_started_at,
        repair_completed_at=payload.repair_completed_at,
        authorized_for_service=False,
        released_at=None,
    )

    db.add(record)
    db.flush()
    db.commit()
    db.refresh(record)
    return record


def create_test_record(
    db: Session,
    fault_id: UUID,
    performed_by: UUID,
    payload,
) -> RepairVerificationRecord:
    """Create a test record using the equipment associated with the fault."""
    fault = db.scalar(select(Fault).where(Fault.fault_id == fault_id))

    if fault is None:
        raise HTTPException(status_code=404, detail="Fault not found")

    record = RepairVerificationRecord(
        fault_id=fault.fault_id,
        equipment_id=fault.equipment_id,
        record_type=payload.record_type,
        performed_by=performed_by,
        performed_by_role="biomedical_engineer",
        test_result=payload.test_result,
        test_details=payload.test_details,
        authorized_for_service=False,
        released_at=None,
    )

    db.add(record)
    db.flush()
    db.commit()
    db.refresh(record)
    return record


def get_latest_test(
    db: Session,
    fault_id: UUID,
    test_type: str,
) -> RepairVerificationRecord | None:
    """Return the most recently recorded test of the requested type."""
    return db.scalar(
        select(RepairVerificationRecord)
        .where(
            RepairVerificationRecord.fault_id == fault_id,
            RepairVerificationRecord.record_type == test_type,
        )
        .order_by(
            RepairVerificationRecord.performed_at.desc(),
            RepairVerificationRecord.record_id.desc(),
        )
    )


def create_release_record(
    db: Session,
    fault_id: UUID,
    performed_by: UUID,
    payload=None,
) -> RepairVerificationRecord:
    """
    Create a release record within the caller's transaction.

    The fault row is locked to reduce concurrent duplicate releases.
    The database's unique partial index remains the final safeguard.
    """
    fault = db.scalar(select(Fault).where(Fault.fault_id == fault_id).with_for_update())

    if fault is None:
        raise HTTPException(status_code=404, detail="Fault not found")

    existing_release = db.scalar(
        select(RepairVerificationRecord).where(
            RepairVerificationRecord.fault_id == fault_id,
            RepairVerificationRecord.authorized_for_service.is_(True),
        )
    )

    if existing_release is not None:
        raise HTTPException(
            status_code=409,
            detail="This fault has already been released.",
        )

    record = RepairVerificationRecord(
        fault_id=fault.fault_id,
        equipment_id=fault.equipment_id,
        record_type="release",
        performed_by=performed_by,
        performed_by_role="biomedical_engineer",
        test_details=getattr(payload, "test_details", None),
        authorized_for_service=True,
        released_at=datetime.now(timezone.utc),
    )

    db.add(record)
    db.flush()
    db.commit()
    db.refresh(record)
    return record


def get_records(
    db: Session,
    fault_id: UUID,
) -> list[RepairVerificationRecord]:
    """Return repair, test, and release records for a fault."""
    return list(
        db.scalars(
            select(RepairVerificationRecord)
            .where(RepairVerificationRecord.fault_id == fault_id)
            .order_by(
                RepairVerificationRecord.performed_at.asc(),
                RepairVerificationRecord.record_id.asc(),
            )
        ).all()
    )
