import os
from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.enums import PriorityLevel
from models.fault_assessment import FaultAssessment
from models.user import User
from repositories.fault_assessment_repository import FaultAssessmentRepository
from schemas.fault_assessment import FaultAssessmentCreate

RULE_VERSION = "v1"


class AssessmentService:
    def __init__(self, repository: FaultAssessmentRepository | None = None):
        self.repository = repository or FaultAssessmentRepository()

    def calculate_history_factor(
        self,
        fault_count: int,
        longest_downtime: timedelta | None,
    ) -> int:
        downtime_days = (
            longest_downtime.total_seconds() / 86400
            if longest_downtime is not None
            else 0
        )

        if fault_count >= 3 or downtime_days > 30:
            return 3

        if fault_count >= 2 or downtime_days > 7:
            return 2

        if fault_count == 1:
            return 1

        return 0

    def calculate_priority_score(
        self,
        severity_factor: int,
        clinical_criticality: int,
        backup_available: bool,
        history_factor: int,
    ) -> int:
        backup_factor = 0 if backup_available else 2

        return severity_factor + clinical_criticality + backup_factor + history_factor

    def calculate_rule_priority_level(
        self,
        severity_factor: int,
        clinical_criticality: int,
        backup_available: bool,
        priority_score: int,
    ) -> PriorityLevel:
        if severity_factor == 4 and clinical_criticality == 3 and not backup_available:
            return PriorityLevel.CRITICAL

        if priority_score <= 4:
            return PriorityLevel.LOW

        if priority_score <= 7:
            return PriorityLevel.MEDIUM

        if priority_score <= 9:
            return PriorityLevel.HIGH

        return PriorityLevel.CRITICAL

    def create_assessment(
        self,
        db: Session,
        fault_id: UUID,
        assessed_by: UUID,
        data: FaultAssessmentCreate,
    ) -> FaultAssessment:
        fault = self.repository.get_fault(db, fault_id)

        if fault is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fault not found",
            )

        fault_count = self.repository.count_recent_equipment_faults(
            db=db,
            equipment_id=fault.equipment_id,
            current_fault_id=fault_id,
        )

        longest_downtime = self.repository.get_longest_recent_downtime(
            db=db,
            equipment_id=fault.equipment_id,
            current_fault_id=fault_id,
        )

        history_factor = self.calculate_history_factor(
            fault_count=fault_count,
            longest_downtime=longest_downtime,
        )

        priority_score = self.calculate_priority_score(
            severity_factor=data.severity_factor,
            clinical_criticality=data.clinical_criticality,
            backup_available=data.backup_available,
            history_factor=history_factor,
        )

        rule_priority_level = self.calculate_rule_priority_level(
            severity_factor=data.severity_factor,
            clinical_criticality=data.clinical_criticality,
            backup_available=data.backup_available,
            priority_score=priority_score,
        )

        if (
            data.priority_level != rule_priority_level
            and not data.priority_explanation.strip()
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Priority explanation is required when the final "
                    "priority differs from the rule priority"
                ),
            )

        assessment = FaultAssessment(
            fault_id=fault_id,
            assessed_by=assessed_by,
            findings=data.findings,
            condition=data.condition,
            recommended_action=data.recommended_action,
            severity_factor=data.severity_factor,
            clinical_criticality=data.clinical_criticality,
            backup_available=data.backup_available,
            history_factor=history_factor,
            priority_score=priority_score,
            rule_priority_level=rule_priority_level.value,
            priority_level=data.priority_level.value,
            priority_explanation=data.priority_explanation,
            rule_version=RULE_VERSION,
            is_current=True,
        )

        try:
            self.repository.clear_current_assessment(db, fault_id)

            self.repository.create_assessment(
                db=db,
                assessment=assessment,
            )

            db.commit()
            db.refresh(assessment)

            return assessment

        except Exception:
            db.rollback()
            raise

    def get_fault_assessments(
        self,
        db: Session,
        fault_id: UUID,
    ) -> list[FaultAssessment]:
        fault = self.repository.get_fault(db, fault_id)

        if fault is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fault not found",
            )

        return self.repository.get_assessments_for_fault(
            db=db,
            fault_id=fault_id,
        )

    def get_engineer(
        self,
        db: Session,
        engineer_id: UUID,
    ) -> User:
        if os.getenv("APP_ENV") != "development":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Engineer authentication is not configured.",
            )

        engineer = self.repository.get_engineer_by_id(
            db=db,
            engineer_id=engineer_id,
        )

        if engineer is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Engineer not found.",
            )

        return engineer
