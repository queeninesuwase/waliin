from uuid import UUID

from fastapi import HTTPException

from repositories import repair_verification_record as repository
from schemas.repair_verification_record import (
    RepairVerificationRecordCreate,
    RepairVerificationRecordUpdate,
)


def create_record(db, payload: RepairVerificationRecordCreate):
    return repository.create(db, payload)


def list_records(db, skip: int = 0, limit: int = 100):
    return repository.get_all(db, skip=skip, limit=limit)


def get_record(db, record_id: UUID):
    record = repository.get_by_id(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


def update_record(
    db,
    record_id: UUID,
    payload: RepairVerificationRecordUpdate,
):
    record = get_record(db, record_id)
    return repository.update(db, record, payload)


def delete_record(db, record_id: UUID):
    record = get_record(db, record_id)
    repository.delete(db, record)
