from sqlalchemy import case, select
from sqlalchemy.orm import Session

from models.department import Department
from models.equipment import Equipment
from models.fault import Fault
from models.fault_assessment import FaultAssessment
from models.fault_downtime import FaultDowntime


class PriorityListRepository:
    def get_priority_list(self, db: Session):
        priority_order = case(
            (FaultAssessment.priority_level == "critical", 1),
            (FaultAssessment.priority_level == "high", 2),
            (FaultAssessment.priority_level == "medium", 3),
            (FaultAssessment.priority_level == "low", 4),
            else_=5,
        )

        stmt = (
            select(
                Fault.fault_id,
                Fault.equipment_id,
                Equipment.model_name.label("equipment_name"),
                Equipment.asset_tag,
                Department.department_name,
                Fault.status.label("fault_status"),
                FaultAssessment.priority_score,
                FaultAssessment.priority_level,
                FaultAssessment.priority_explanation,
                FaultAssessment.severity_factor,
                FaultAssessment.clinical_criticality,
                FaultAssessment.backup_available,
                Fault.reported_at,
                FaultDowntime.downtime,
                FaultDowntime.still_down,
                Fault.assigned_engineer_id,
            )
            .join(
                FaultAssessment,
                FaultAssessment.fault_id == Fault.fault_id,
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
                FaultDowntime,
                FaultDowntime.fault_id == Fault.fault_id,
            )
            .where(
                FaultAssessment.is_current.is_(True),
                Fault.status.notin_(["closed", "cancelled"]),
            )
            .order_by(
                priority_order,
                FaultAssessment.priority_score.desc(),
                Fault.reported_at.asc(),
            )
        )

        return db.execute(stmt).mappings().all()
