from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from models.enums import PriorityLevel


class FaultAssessmentCreate(BaseModel):
    findings: str = Field(min_length=1)
    condition: str = Field(min_length=1, max_length=80)
    recommended_action: str = Field(min_length=1)
    severity_factor: int = Field(ge=1, le=4)
    clinical_criticality: int = Field(ge=1, le=3)
    backup_available: bool
    priority_level: PriorityLevel
    priority_explanation: str = Field(min_length=1)

    @field_validator(
        "findings",
        "condition",
        "recommended_action",
        "priority_explanation",
    )
    @classmethod
    def strip_and_reject_blank(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Value cannot be blank")

        return value


class FaultAssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    assessment_id: UUID
    fault_id: UUID
    assessed_by: UUID
    assessed_at: datetime

    findings: str
    condition: str
    recommended_action: str

    severity_factor: int
    clinical_criticality: int
    backup_available: bool
    history_factor: int

    priority_score: int
    rule_priority_level: PriorityLevel
    priority_level: PriorityLevel
    priority_explanation: str

    rule_version: str
    is_current: bool
