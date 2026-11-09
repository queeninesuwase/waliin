from uuid import UUID

from sqlalchemy.orm import Session

from models.request_item import RequestItem


def create_items(db: Session, request_id: UUID, items):
    created = []
    for item in items:
        qty = getattr(item, "quantity_requested", 0)
        if qty <= 0:
            raise ValueError("quantity_requested > 0 required")
        name = (
            getattr(item, "item_name_or_service", None)
            or getattr(item, "item_name", None)
            or getattr(item, "name", None)
            or ""
        )
        # Check if item with same name exists
        existing = (
            db.query(RequestItem)
            .filter(RequestItem.request_id == request_id)
            .filter(RequestItem.item_name == name)
            .first()
        )
        if existing:
            existing.quantity_requested = qty
            spec = getattr(item, "technical_specifications", None) or getattr(
                item, "specification", None
            )
            if spec is not None:
                existing.specification = spec
            db.flush()
            created.append(existing)
            continue
        rec = RequestItem(
            request_id=request_id,
            item_name=name,
            specification=getattr(item, "technical_specifications", None)
            or getattr(item, "specification", None),
            quantity_requested=qty,
            quantity_fulfilled=0,
        )
        db.add(rec)
        db.flush()
        created.append(rec)
    return created


def get_items_by_request(db: Session, request_id: UUID):
    return db.query(RequestItem).filter(RequestItem.request_id == request_id).all()


def update_fulfilled(db: Session, item_id: UUID, quantity_fulfilled: int):
    item = db.query(RequestItem).filter(RequestItem.item_id == item_id).first()
    if not item:
        return None
    if (
        item.quantity_approved is not None
        and quantity_fulfilled > item.quantity_approved
    ):
        raise ValueError("quantity_fulfilled <= approved")
    if quantity_fulfilled < 0:
        raise ValueError("quantity_fulfilled >= 0")
    item.quantity_fulfilled = quantity_fulfilled
    db.commit()
    db.refresh(item)
    return item
