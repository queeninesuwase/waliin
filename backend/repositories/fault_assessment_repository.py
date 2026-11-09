from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from models.fault import Fault
from models.user import User
from models.fault_assessment import FaultAssessment
from models.fault_downtime import FaultDowntime


class FaultAssessmentRepository:
    def get_fault(self, db: Session, fault_id: UUID) -> Fault | None:
        return db.scalar(select(Fault).where(Fault.fault_id == fault_id))

    def get_assessments_for_fault(
        self,
        db: Session,
        fault_id: UUID,
    ) -> list[FaultAssessment]:
        return list(
            db.scalars(
                select(FaultAssessment)
                .where(FaultAssessment.fault_id == fault_id)
                .order_by(FaultAssessment.assessed_at.desc())
            ).all()
        )

    def clear_current_assessment(self, db: Session, fault_id: UUID) -> None:
        db.execute(
            update(FaultAssessment)
            .where(
                FaultAssessment.fault_id == fault_id,
                FaultAssessment.is_current.is_(True),
            )
            .values(is_current=False)
        )

    def count_recent_equipment_faults(
        self,
        db: Session,
        equipment_id: UUID,
        current_fault_id: UUID,
    ) -> int:
        twelve_months_ago = datetime.now(timezone.utc) - timedelta(days=365)

        return (
            db.scalar(
                select(func.count(Fault.fault_id)).where(
                    Fault.equipment_id == equipment_id,
                    Fault.fault_id != current_fault_id,
                    Fault.reported_at >= twelve_months_ago,
                )
            )
            or 0
        )

    def get_longest_recent_downtime(
        self,
        db: Session,
        equipment_id: UUID,
        current_fault_id: UUID,
    ) -> timedelta | None:
        twelve_months_ago = datetime.now(timezone.utc) - timedelta(days=365)

        return db.scalar(
            select(func.max(FaultDowntime.downtime)).where(
                FaultDowntime.equipment_id == equipment_id,
                FaultDowntime.fault_id != current_fault_id,
                FaultDowntime.out_of_service_at >= twelve_months_ago,
            )
        )

    def create_assessment(
        self,
        db: Session,
        assessment: FaultAssessment,
    ) -> FaultAssessment:
        db.add(assessment)
        db.flush()
        return assessment

    def get_engineer_by_id(
        self,
        db: Session,
        engineer_id: UUID,
    ) -> User | None:
        return db.get(User, engineer_id)
