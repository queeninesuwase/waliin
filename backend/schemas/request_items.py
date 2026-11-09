from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RequestItemsCreate(BaseModel):
    item_name_or_service: str | None = None
    item_name: str | None = None
    technical_specifications: str | None = None
    quantity_requested: int


class RequestItemsResponse(BaseModel):
    item_id: UUID
    request_id: UUID
    item_name_or_service: str | None = None
    technical_specifications: str | None = None
    quantity_requested: int
    quantity_approved: int | None = None
    quantity_fulfilled: int | None = 0

    model_config = ConfigDict(from_attributes=True)
