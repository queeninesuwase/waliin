from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from schemas.request_items import RequestItemsCreate, RequestItemsResponse


class ResourceRequestsCreate(BaseModel):
    request_type: str
    justification: str
    related_fault_id: UUID | None = None
    items: list[RequestItemsCreate] = []


class ResourceRequestsUpdate(BaseModel):
    request_type: str | None = None
    justification: str | None = None
    related_fault_id: UUID | None = None
    items: list[RequestItemsCreate] | None = None


class ResourceRequestsDecide(BaseModel):
    approval_status: str
    manager_id: UUID | None = None
    decision_reason: str | None = None


class ResourceRequestsResponse(BaseModel):
    request_id: UUID
    requested_by: UUID
    related_fault_id: UUID | None = None
    request_type: str
    justification: str
    status: str | None = None
    decision_by: UUID | None = None
    decision_reason: str | None = None
    requested_at: datetime | None = None
    decided_at: datetime | None = None
    resolved_at: datetime | None = None
    items: list[RequestItemsResponse] | None = None

    model_config = ConfigDict(from_attributes=True)
