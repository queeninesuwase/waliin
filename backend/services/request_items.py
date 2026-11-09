from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from repositories import request_items as repository


def get_items_by_request(db: Session, request_id: UUID):
    return repository.get_items_by_request(db, request_id)


def update_item_fulfilled(db: Session, item_id: UUID, quantity_fulfilled: int):
    if quantity_fulfilled is None:
        raise HTTPException(status_code=400, detail="quantity_fulfilled required")
    try:
        item = repository.update_fulfilled(db, item_id, quantity_fulfilled)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return item
