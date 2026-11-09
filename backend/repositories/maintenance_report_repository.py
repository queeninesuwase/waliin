from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.department import Department
from models.equipment import Equipment
from models.fault import Fault
from models.fault_assessment import FaultAssessment
from models.fault_downtime import FaultDowntime
from models.repair_verification_record import RepairVerificationRecord
from models.resource_request import ResourceRequest


class MaintenanceReportRepository:
    def get_fault_summary(self, db: Session) -> dict[str, int]:
        total_faults = db.scalar(select(func.count(Fault.fault_id))) or 0

        open_faults = (
            db.scalar(
                select(func.count(Fault.fault_id)).where(
                    Fault.status.notin_(["closed", "cancelled"])
                )
            )
            or 0
        )

        closed_faults = (
            db.scalar(
                select(func.count(Fault.fault_id)).where(Fault.status == "closed")
            )
            or 0
        )

        return {
            "total_faults": total_faults,
            "open_faults": open_faults,
            "closed_faults": closed_faults,
        }

    def get_priority_breakdown(self, db: Session) -> dict[str, int]:
        rows = db.execute(
            select(
                FaultAssessment.priority_level,
                func.count(FaultAssessment.assessment_id),
            )
            .join(
                Fault,
                Fault.fault_id == FaultAssessment.fault_id,
            )
            .where(
                FaultAssessment.is_current.is_(True),
                Fault.status.notin_(["closed", "cancelled"]),
            )
            .group_by(FaultAssessment.priority_level)
        ).all()

        counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
        }

        for priority_level, count in rows:
            if priority_level in counts:
                counts[priority_level] = count

        return counts

    def get_downtime_summary(
        self,
        db: Session,
    ) -> dict[str, int | timedelta]:
        equipment_still_down = (
            db.scalar(
                select(func.count(FaultDowntime.fault_id)).where(
                    FaultDowntime.still_down.is_(True)
                )
            )
            or 0
        )

        downtime_values = db.scalars(select(FaultDowntime.downtime)).all()

        total_downtime = sum(
            downtime_values,
            start=timedelta(),
        )

        average_downtime = (
            total_downtime / len(downtime_values) if downtime_values else timedelta()
        )

        return {
            "equipment_still_down": equipment_still_down,
            "total_downtime": total_downtime,
            "average_downtime": average_downtime,
        }

    def get_repair_summary(self, db: Session) -> dict[str, int]:
        repairs_completed = (
            db.scalar(
                select(
                    func.count(func.distinct(RepairVerificationRecord.fault_id))
                ).where(
                    RepairVerificationRecord.record_type == "repair",
                    RepairVerificationRecord.repair_completed_at.is_not(None),
                )
            )
            or 0
        )

        equipment_returned_to_service = (
            db.scalar(
                select(
                    func.count(func.distinct(RepairVerificationRecord.fault_id))
                ).where(RepairVerificationRecord.authorized_for_service.is_(True))
            )
            or 0
        )

        return {
            "repairs_completed": repairs_completed,
            "equipment_returned_to_service": equipment_returned_to_service,
        }

    def get_resource_request_summary(
        self,
        db: Session,
    ) -> dict[str, int]:
        pending_requests = (
            db.scalar(
                select(func.count(ResourceRequest.request_id)).where(
                    ResourceRequest.status == "pending"
                )
            )
            or 0
        )

        resolved_requests = (
            db.scalar(
                select(func.count(ResourceRequest.request_id)).where(
                    ResourceRequest.status == "resolved"
                )
            )
            or 0
        )

        return {
            "pending_requests": pending_requests,
            "resolved_requests": resolved_requests,
        }

    def get_active_fault_details(self, db: Session):
        stmt = (
            select(
                Fault.fault_id,
                Equipment.model_name.label("equipment_name"),
                Equipment.asset_tag,
                Department.department_name,
                Fault.status.label("fault_status"),
                Fault.description,
                Fault.reported_at,
                FaultAssessment.priority_level,
                FaultAssessment.priority_score,
                FaultAssessment.priority_explanation,
                FaultDowntime.downtime,
                FaultDowntime.still_down,
            )
            .join(
                Equipment,
                Equipment.equipment_id == Fault.equipment_id,
            )
            .join(
                Department,
                Department.department_id == Equipment.department_id,
            )
            .outerjoin(
                FaultAssessment,
                FaultAssessment.fault_id == Fault.fault_id,
            )
            .outerjoin(
                FaultDowntime,
                FaultDowntime.fault_id == Fault.fault_id,
            )
            .where(
                Fault.status.notin_(["closed", "cancelled"]),
                (
                    FaultAssessment.is_current.is_(True)
                    | FaultAssessment.is_current.is_(None)
                ),
            )
            .order_by(
                FaultAssessment.priority_score.desc().nullslast(),
                Fault.reported_at.asc(),
            )
        )

        return db.execute(stmt).mappings().all()
