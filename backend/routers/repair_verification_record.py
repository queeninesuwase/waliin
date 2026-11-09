from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from database import get_db
from schemas.repair_verification_record import (
    RepairVerificationRecordCreate,
    RepairVerificationRecordResponse,
    RepairVerificationRecordUpdate,
)
from services import repair_verification_record as service

router = APIRouter(
    prefix="/repair-verification-records",
    tags=["Repair Verification Records"],
)


@router.post("/", response_model=RepairVerificationRecordResponse)
def create_record(
    payload: RepairVerificationRecordCreate,
    db: Session = Depends(get_db),
    user_id: UUID = Header(...),
):
    return service.create_record(db, payload)


@router.get("/", response_model=List[RepairVerificationRecordResponse])
def list_records(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user_id: UUID = Header(...),
):
    return service.list_records(db, skip=skip, limit=limit)


@router.get("/{record_id}", response_model=RepairVerificationRecordResponse)
def get_record(
    record_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Header(...),
):
    return service.get_record(db, record_id)


@router.put("/{record_id}", response_model=RepairVerificationRecordResponse)
def update_record(
    record_id: UUID,
    payload: RepairVerificationRecordUpdate,
    db: Session = Depends(get_db),
    user_id: UUID = Header(...),
):
    return service.update_record(db, record_id, payload)


@router.delete("/{record_id}", status_code=204)
def delete_record(
    record_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Header(...),
):
    service.delete_record(db, record_id)
