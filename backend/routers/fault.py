from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from schemas.fault import (
    FaultAssign,
    FaultClose,
    FaultCreate,
    FaultOut,
    FaultStatusUpdate,
)
from services.fault import FaultService

router = APIRouter(prefix="/faults", tags=["faults"])

fault_service = FaultService()


@router.post("/", response_model=FaultOut, status_code=status.HTTP_201_CREATED)
def create_fault(fault_in: FaultCreate, db: Session = Depends(get_db)):
    return fault_service.create_fault(db, fault_in)


@router.get("/", response_model=List[FaultOut])
def list_faults(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return fault_service.list_faults(db, skip=skip, limit=limit)


@router.get("/{fault_id}", response_model=FaultOut)
def get_fault(fault_id: UUID, db: Session = Depends(get_db)):
    return fault_service.get_fault(db, fault_id)


@router.post("/{fault_id}/assign", response_model=FaultOut)
def assign_fault(fault_id: UUID, assign_in: FaultAssign, db: Session = Depends(get_db)):
    return fault_service.assign_fault(db, fault_id, assign_in)


@router.post("/{fault_id}/status", response_model=FaultOut)
def update_status(
    fault_id: UUID, status_in: FaultStatusUpdate, db: Session = Depends(get_db)
):
    return fault_service.update_status(db, fault_id, status_in)


@router.post("/{fault_id}/close", response_model=FaultOut)
def close_fault(fault_id: UUID, close_in: FaultClose, db: Session = Depends(get_db)):
    return fault_service.close_fault(db, fault_id, close_in)
