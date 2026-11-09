from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class NotificationCreate(BaseModel):
    recipient_user_id: UUID
    notification_type: str
    message: str
    related_equipment_id: Optional[UUID] = None
    related_fault_id: Optional[UUID] = None
    related_request_id: Optional[UUID] = None
    channel: str = "in_app"


class NotificationRead(BaseModel):
    notification_id: UUID
    recipient_user_id: UUID
    notification_type: str
    message: str
    channel: str
    created_at: datetime
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
