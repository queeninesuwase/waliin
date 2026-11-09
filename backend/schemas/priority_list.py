from datetime import datetime, timedelta
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PriorityListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    fault_id: UUID
    equipment_id: UUID
    equipment_name: str
    asset_tag: str
    department_name: str
    fault_status: str
    priority_score: int
    priority_level: str
    priority_explanation: str
    severity_factor: int
    clinical_criticality: int
    backup_available: bool
    reported_at: datetime
    downtime: timedelta | None = None
    still_down: bool | None = None
    assigned_engineer_id: UUID | None = None
