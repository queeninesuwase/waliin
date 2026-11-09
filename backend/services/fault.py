import logging
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.enums import FaultStatus
from models.fault import Fault
from repositories.fault import FaultRepository
from schemas.fault import FaultAssign, FaultClose, FaultCreate, FaultStatusUpdate

logger = logging.getLogger(__name__)


def _snippet(text, limit=60):
    text = str(text)
    return text if len(text) <= limit else text[: limit - 3] + "..."


class FaultService:
    def __init__(
        self,
        fault_repo: FaultRepository = None,
    ):
        self.fault_repo = fault_repo or FaultRepository()

    def create_fault(self, db: Session, fault_in: FaultCreate) -> Fault:
        if fault_in.client_report_id:
            existing = self.fault_repo.get_by_client_report_id(
                db, fault_in.client_report_id
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A fault record with client_report_id '{fault_in.client_report_id}' already exists.",
                )

        fault = Fault(**fault_in.model_dump())
        fault.status = FaultStatus.REPORTED.value
        try:
            created = self.fault_repo.create(db, fault)

            self.fault_repo.commit(db)
            self.fault_repo.refresh(db, created)
            return created
        except Exception as e:
            self.fault_repo.rollback(db)
            if (
                "unique constraint" in str(e).lower()
                or "duplicate key" in str(e).lower()
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Database integrity violation. Duplicate unique value detected.",
                )
            raise

    def get_fault(self, db: Session, fault_id: UUID) -> Fault:
        fault = self.fault_repo.get(db, fault_id)
        if not fault:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Fault not found"
            )
        return fault

    def list_faults(self, db: Session, skip: int = 0, limit: int = 100) -> List[Fault]:
        return self.fault_repo.list(db, skip=skip, limit=limit)

    def assign_fault(
        self, db: Session, fault_id: UUID, assign_in: FaultAssign
    ) -> Fault:
        fault = self.get_fault(db, fault_id)
        fault.assigned_engineer_id = assign_in.assigned_engineer_id
        fault.assigned_engineer_role = assign_in.assigned_engineer_role
        if fault.status == FaultStatus.REPORTED.value:
            fault.status = FaultStatus.ASSIGNED.value
        updated = self.fault_repo.update(db, fault)

        try:
            self.fault_repo.commit(db)
            self.fault_repo.refresh(db, updated)
        except Exception as e:
            self.fault_repo.rollback(db)
            if "foreign key" in str(e).lower() or "check constraint" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Database integrity violation.",
                )
            raise
        return updated

    def update_status(
        self, db: Session, fault_id: UUID, status_in: FaultStatusUpdate
    ) -> Fault:
        fault = self.get_fault(db, fault_id)
        new_status = (
            status_in.status.value
            if hasattr(status_in.status, "value")
            else status_in.status
        )
        fault.status = new_status
        if status_in.out_of_service_at is not None:
            fault.out_of_service_at = status_in.out_of_service_at
        if status_in.closed_at is not None:
            fault.closed_at = status_in.closed_at
        elif new_status not in (FaultStatus.CLOSED.value, FaultStatus.CANCELLED.value):
            fault.closed_at = None
        updated = self.fault_repo.update(db, fault)

        try:
            self.fault_repo.commit(db)
            self.fault_repo.refresh(db, updated)
        except Exception as e:
            self.fault_repo.rollback(db)
            if "foreign key" in str(e).lower() or "check constraint" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Database integrity violation.",
                )
            raise
        return updated

    def close_fault(self, db: Session, fault_id: UUID, close_in: FaultClose) -> Fault:
        closed_at = close_in.closed_at or datetime.now(timezone.utc)
        return self.update_status(
            db,
            fault_id,
            FaultStatusUpdate(status=FaultStatus.CLOSED, closed_at=closed_at),
        )
