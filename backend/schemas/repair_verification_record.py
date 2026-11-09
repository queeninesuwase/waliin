from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RepairVerificationRecordBase(BaseModel):
    fault_id: UUID
    equipment_id: UUID
    record_type: str
    performed_by: UUID
    performed_by_role: str = "biomedical_engineer"
    work_performed: Optional[str] = None
    parts_used: Optional[str] = None
    repair_started_at: Optional[datetime] = None
    repair_completed_at: Optional[datetime] = None
    test_result: Optional[str] = None
    test_details: Optional[str] = None
    authorized_for_service: bool = False
    performed_at: Optional[datetime] = None
    released_at: Optional[datetime] = None


class RepairVerificationRecordCreate(RepairVerificationRecordBase):
    pass


class RepairVerificationRecordUpdate(BaseModel):
    record_type: Optional[str] = None
    work_performed: Optional[str] = None
    parts_used: Optional[str] = None
    repair_started_at: Optional[datetime] = None
    repair_completed_at: Optional[datetime] = None
    test_result: Optional[str] = None
    test_details: Optional[str] = None
    authorized_for_service: Optional[bool] = None
    performed_at: Optional[datetime] = None
    released_at: Optional[datetime] = None


class RepairVerificationRecordResponse(RepairVerificationRecordBase):
    record_id: UUID

    model_config = ConfigDict(from_attributes=True)
