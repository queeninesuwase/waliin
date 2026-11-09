from uuid import UUID

from fastapi import APIRouter, Depends, Header

from database import get_db
from schemas.request_follow_ups import (
    RequestFollowUpsCreate,
    RequestFollowUpsReply,
    RequestFollowUpsResponse,
    RequestFollowUpsUpdate,
)
from services import request_follow_ups_service as service

router = APIRouter(tags=["Request Follow Ups"])


@router.post(
    "/requests/{request_id}/follow-ups",
    response_model=RequestFollowUpsResponse,
    status_code=201,
)
def log_follow_up(
    request_id: UUID,
    payload: RequestFollowUpsCreate,
    db=Depends(get_db),
    x_user_role: str = Header(None),
    user_id: UUID = Header(None),
):
    return service.log_follow_up_manager(db, request_id, user_id, x_user_role, payload)


@router.get(
    "/requests/{request_id}/follow-ups", response_model=list[RequestFollowUpsResponse]
)
def get_follow_ups(request_id: UUID, db=Depends(get_db)):
    return service.get_follow_ups(db, request_id)


@router.post(
    "/follow-ups/{follow_up_id}/reply", response_model=RequestFollowUpsResponse
)
def log_reply(
    follow_up_id: UUID,
    payload: RequestFollowUpsReply,
    db=Depends(get_db),
):
    return service.log_reply(db, follow_up_id, payload)


@router.patch("/follow-ups/{follow_up_id}", response_model=RequestFollowUpsResponse)
def update_follow_up(
    follow_up_id: UUID,
    payload: RequestFollowUpsUpdate,
    db=Depends(get_db),
):
    return service.update_follow_up(db, follow_up_id, payload)
