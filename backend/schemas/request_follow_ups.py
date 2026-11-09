from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RequestFollowUpsCreate(BaseModel):
    organisation: str
    channel: str
    sent_date: date | None = None
    sent_at: date | None = None
    next_follow_up_date: date | None = None
    note: str | None = None


class RequestFollowUpsReply(BaseModel):
    reply_status: str | None = None
    reply_at: date | None = None
    note: str | None = None


class RequestFollowUpsUpdate(BaseModel):
    organisation: str | None = None
    channel: str | None = None
    sent_date: date | None = None
    sent_at: date | None = None
    next_follow_up_date: date | None = None
    reply_status: str | None = None
    reply_at: date | None = None
    note: str | None = None


class RequestFollowUpsResponse(BaseModel):
    follow_up_id: UUID
    request_id: UUID
    organisation: str
    channel: str
    sent_at: date
    next_follow_up_date: date | None = None
    reply_status: str
    reply_at: date | None = None
    note: str | None = None
    logged_by: UUID
    logged_by_role: str
    logged_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
