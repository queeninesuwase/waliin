from uuid import UUID

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from database import get_db
from schemas.repair_work import (
    RepairCreate,
    TestCreate,
    ReleaseCreate,
    RepairRecordResponse,
)
from services import repair_work as service


router = APIRouter(tags=["Repairs"])


@router.post(
    "/faults/{fault_id}/repairs",
    response_model=RepairRecordResponse,
)
def add_repair(
    fault_id: UUID,
    payload: RepairCreate,
    db: Session = Depends(get_db),
    user_id: UUID = Header(...),
):
    return service.add_repair(db, fault_id, user_id, payload)


@router.post(
    "/faults/{fault_id}/tests",
    response_model=RepairRecordResponse,
)
def add_test(
    fault_id: UUID,
    payload: TestCreate,
    db: Session = Depends(get_db),
    user_id: UUID = Header(...),
):
    return service.add_test(db, fault_id, user_id, payload)


@router.post(
    "/faults/{fault_id}/release",
    response_model=RepairRecordResponse,
)
def release_fault(
    fault_id: UUID,
    payload: ReleaseCreate | None = None,
    db: Session = Depends(get_db),
    user_id: UUID = Header(...),
):
    return service.release_fault(db, fault_id, user_id, payload or ReleaseCreate())


@router.get(
    "/faults/{fault_id}/records",
    response_model=list[RepairRecordResponse],
)
def get_records(
    fault_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_records(db, fault_id)
