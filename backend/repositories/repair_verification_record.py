from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.repair_verification_record import RepairVerificationRecord
from schemas.repair_verification_record import (
    RepairVerificationRecordCreate,
    RepairVerificationRecordUpdate,
)


def create(db: Session, payload: RepairVerificationRecordCreate):
    record = RepairVerificationRecord(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_by_id(db: Session, record_id: UUID):
    return db.scalar(
        select(RepairVerificationRecord).where(
            RepairVerificationRecord.record_id == record_id
        )
    )


def get_all(db: Session, skip: int = 0, limit: int = 100):
    return list(
        db.scalars(select(RepairVerificationRecord).offset(skip).limit(limit)).all()
    )


def update(
    db: Session,
    record: RepairVerificationRecord,
    payload: RepairVerificationRecordUpdate,
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


def delete(db: Session, record: RepairVerificationRecord):
    db.delete(record)
    db.commit()
