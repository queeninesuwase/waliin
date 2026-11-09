from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from models.enums import FaultSeverity, FaultStatus


class FaultBase(BaseModel):
    description: str = Field(min_length=1)
    severity: FaultSeverity
    failure_observed_at: Optional[datetime] = None
    client_report_id: Optional[UUID] = None


class FaultCreate(FaultBase):
    equipment_id: UUID
    reported_by: UUID


class FaultUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1)
    severity: Optional[FaultSeverity] = None
    failure_observed_at: Optional[datetime] = None


class FaultAssign(BaseModel):
    assigned_engineer_id: UUID
    assigned_engineer_role: str = Field(default="biomedical_engineer")


class FaultStatusUpdate(BaseModel):
    status: FaultStatus
    reason: Optional[str] = None
    changed_by: Optional[UUID] = None
    out_of_service_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None


class FaultClose(BaseModel):
    reason: Optional[str] = None
    changed_by: Optional[UUID] = None
    closed_at: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class FaultCancel(BaseModel):
    reason: Optional[str] = None
    changed_by: Optional[UUID] = None
    closed_at: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class FaultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    fault_id: UUID
    equipment_id: UUID
    reported_by: UUID
    client_report_id: Optional[UUID] = None
    assigned_engineer_id: Optional[UUID] = None
    assigned_engineer_role: str
    description: str
    severity: str
    status: str
    failure_observed_at: Optional[datetime] = None
    reported_at: datetime
    out_of_service_at: Optional[datetime] = None
    updated_at: datetime
    closed_at: Optional[datetime] = None
