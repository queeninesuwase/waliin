from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas.request_items import RequestItemsResponse
from services.request_items import (
    get_items_by_request,
    update_item_fulfilled,
)

router = APIRouter(tags=["Request Items"])


@router.get("/requests/{request_id}/items", response_model=list[RequestItemsResponse])
def get_items(request_id: UUID, db: Session = Depends(get_db)):
    return get_items_by_request(db, request_id)


@router.patch(
    "/requests/{request_id}/items/{item_id}", response_model=RequestItemsResponse
)
def update_item(
    request_id: UUID,
    item_id: UUID,
    quantity_fulfilled: int = None,
    db: Session = Depends(get_db),
):
    return update_item_fulfilled(db, item_id, quantity_fulfilled)
