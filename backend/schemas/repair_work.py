from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


TestType = Literal[
    "functional_test",
    "safety_test",
    "calibration",
    "performance_test",
    "commissioning",
]

TestResult = Literal["pass", "fail"]


class RepairCreate(BaseModel):
    work_performed: str = Field(min_length=1)
    parts_used: str | None = None
    repair_started_at: datetime | None = None
    repair_completed_at: datetime | None = None

    @model_validator(mode="after")
    def validate_repair_dates(self):
        if (
            self.repair_started_at is not None
            and self.repair_completed_at is not None
            and self.repair_completed_at < self.repair_started_at
        ):
            raise ValueError("Repair completion cannot be earlier than repair start.")

        if not self.work_performed.strip():
            raise ValueError("Work performed cannot be blank.")

        return self


class TestCreate(BaseModel):
    record_type: TestType
    test_result: TestResult
    test_details: str | None = None


class ReleaseCreate(BaseModel):
    test_details: str | None = None


class RepairRecordResponse(BaseModel):
    record_id: UUID
    fault_id: UUID
    equipment_id: UUID
    record_type: str
    performed_by: UUID
    performed_by_role: str
    work_performed: str | None = None
    parts_used: str | None = None
    repair_started_at: datetime | None = None
    repair_completed_at: datetime | None = None
    test_result: str | None = None
    test_details: str | None = None
    authorized_for_service: bool
    performed_at: datetime
    released_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
