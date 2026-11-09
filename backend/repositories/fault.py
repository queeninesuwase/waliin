from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from models.fault import Fault


class FaultRepository:
    def get_by_client_report_id(self, db, crid):
        from models.fault import Fault

        return db.query(Fault).filter(Fault.client_report_id == crid).first()

    def get(self, db: Session, fault_id: UUID) -> Optional[Fault]:
        return db.query(Fault).filter(Fault.fault_id == fault_id).first()

    def get_by_id(self, db: Session, fault_id: UUID) -> Optional[Fault]:
        return self.get(db, fault_id)

    def list(self, db: Session, skip: int = 0, limit: int = 100) -> List[Fault]:
        return db.query(Fault).offset(skip).limit(limit).all()

    def list_by_equipment(self, db: Session, equipment_id: UUID) -> List[Fault]:
        return db.query(Fault).filter(Fault.equipment_id == equipment_id).all()

    def list_by_reporter(self, db: Session, reported_by: UUID) -> List[Fault]:
        return db.query(Fault).filter(Fault.reported_by == reported_by).all()

    def create(self, db: Session, fault: Fault) -> Fault:
        db.add(fault)
        db.flush()
        db.refresh(fault)
        return fault

    def update(self, db: Session, fault: Fault, **fields) -> Fault:
        for key, value in fields.items():
            if hasattr(fault, key):
                setattr(fault, key, value)
        db.flush()
        db.refresh(fault)
        return fault

    def delete(self, db: Session, fault: Fault) -> None:
        db.delete(fault)
        db.flush()

    def commit(self, db: Session) -> None:
        db.commit()

    def rollback(self, db: Session) -> None:
        db.rollback()

    def refresh(self, db: Session, instance) -> None:
        db.refresh(instance)
