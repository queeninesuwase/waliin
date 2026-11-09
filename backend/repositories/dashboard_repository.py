from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.equipment import Equipment
from models.enums import FaultStatus, PriorityLevel, ServiceStatus
from models.fault import Fault
from models.fault_assessment import FaultAssessment


class DashboardRepository:
    def count_active_faults(self, db: Session) -> int:
        return (
            db.scalar(
                select(func.count(Fault.fault_id)).where(
                    Fault.status.notin_(
                        [
                            FaultStatus.CLOSED.value,
                            FaultStatus.CANCELLED.value,
                        ]
                    )
                )
            )
            or 0
        )

    def count_priority_faults(
        self,
        db: Session,
        priority_level: PriorityLevel,
    ) -> int:
        return (
            db.scalar(
                select(func.count(FaultAssessment.assessment_id))
                .join(
                    Fault,
                    Fault.fault_id == FaultAssessment.fault_id,
                )
                .where(
                    FaultAssessment.is_current.is_(True),
                    FaultAssessment.priority_level == priority_level.value,
                    Fault.status.notin_(
                        [
                            FaultStatus.CLOSED.value,
                            FaultStatus.CANCELLED.value,
                        ]
                    ),
                )
            )
            or 0
        )

    def count_equipment_by_service_status(
        self,
        db: Session,
        service_status: ServiceStatus,
    ) -> int:
        return (
            db.scalar(
                select(func.count(Equipment.equipment_id)).where(
                    Equipment.service_status == service_status.value
                )
            )
            or 0
        )
