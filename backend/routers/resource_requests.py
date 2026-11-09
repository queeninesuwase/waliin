from uuid import UUID

from fastapi import APIRouter, Depends, Header

from database import get_db
from schemas.resource_requests import (
    ResourceRequestsCreate,
    ResourceRequestsDecide,
    ResourceRequestsUpdate,
)
from services import resource_requests_service as service


router = APIRouter(tags=["Resource Requests"])


@router.post("/requests")
def create_request(
    payload: ResourceRequestsCreate,
    db=Depends(get_db),
    user_id: UUID = Header(None),
):
    return service.create_request(
        db, user_id or UUID("00000000-0000-0000-0000-000000000000"), payload
    )


@router.get("/requests")
def list_requests(db=Depends(get_db)):
    return service.list_requests(db)


@router.get("/requests/overdue")
def list_overdue(db=Depends(get_db)):
    return service.get_overdue(db)


@router.get("/requests/{request_id}")
def get_request(request_id: UUID, db=Depends(get_db)):
    return service.get_request(db, request_id)


@router.patch("/requests/{request_id}")
def update_request(
    request_id: UUID, payload: ResourceRequestsUpdate, db=Depends(get_db)
):
    return service.update_request(db, request_id, payload)


@router.post("/requests/{request_id}/decide")
def decide_request(
    request_id: UUID,
    payload: ResourceRequestsDecide,
    db=Depends(get_db),
    x_user_role: str = Header(None),
    user_id: UUID = Header(None),
):
    service.decide_request_manager(db, request_id, payload, x_user_role, user_id)
    return {"message": "Decision sent successfully"}
