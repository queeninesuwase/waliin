from datetime import date
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from repositories import request_follow_ups_repo as follow_ups_repo
from repositories import request_items as items_repo
from repositories import resource_requests_repo as repo
from repositories import user_repository


def _enrich_request(req, items=None):
    if items is None:
        items = []
    result = {}
    if req:
        result = {
            "request_id": str(req.request_id),
            "request_number": f"REQ-{str(req.request_id)[:8].upper()}",
            "requested_by": str(req.requested_by),
            "user_id": str(req.requested_by),
            "related_fault_id": str(req.related_fault_id)
            if getattr(req, "related_fault_id")
            else None,
            "request_type": getattr(req, "request_type"),
            "justification": getattr(req, "justification"),
            "status": getattr(req, "status"),
            "decision_by": str(req.decision_by)
            if getattr(req, "decision_by")
            else None,
            "decision_reason": getattr(req, "decision_reason", None),
            "requested_at": getattr(req, "requested_at"),
            "decided_at": getattr(req, "decided_at"),
            "resolved_at": getattr(req, "resolved_at"),
            "items": items,
        }
    else:
        result["items"] = items
    try:
        req_by = result.get("requested_by") or result.get("user_id")
        if req_by:
            from database import SessionLocal

            db = SessionLocal()
            try:
                from uuid import UUID as _UUID

                user = user_repository.get_user_by_id(db, _UUID(req_by))
                if user:
                    name = user.full_name
                    result["requester_name"] = name
                    result["requester"] = name
                    result["user"] = {
                        "user_id": str(user.user_id),
                        "full_name": name,
                    }
            finally:
                db.close()
    except Exception:
        pass
    return result


def create_request(db: Session, requested_by: UUID, payload):
    if payload.items:
        for item in payload.items:
            qty = getattr(item, "quantity_requested", 0)
            if qty <= 0:
                raise HTTPException(
                    status_code=400, detail="quantity_requested > 0 required"
                )
    try:
        request_id = repo.create_resource_request(db, requested_by, payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not request_id:
        raise HTTPException(status_code=400, detail="Failed to create request")
    if payload.items:
        try:
            items_repo.create_items(db, request_id, payload.items)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    req = repo.get_resource_request(db, request_id)
    items = []
    try:
        items = items_repo.get_items_by_request(db, request_id)
    except Exception:
        items = []
    return _enrich_request(req, items)


def decide_request(db: Session, request_id: UUID, payload):
    if payload.approval_status not in ["Approved", "Rejected", "Returned"]:
        raise HTTPException(status_code=400, detail="Invalid approval_status")
    row = repo.decide_resource_request(db, request_id, payload)
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    db.commit()
    req = repo.get_resource_request(db, request_id)
    items = []
    try:
        items = items_repo.get_items_by_request(db, request_id)
    except Exception:
        items = []
    return _enrich_request(req, items)


def decide_request_manager(
    db: Session, request_id: UUID, payload, x_user_role, user_id
):
    if x_user_role != "health_manager":
        raise HTTPException(status_code=403, detail="Only health managers can decide")
    if not getattr(payload, "manager_id", None) and user_id:
        payload.manager_id = user_id
    return decide_request(db, request_id, payload)


def list_requests(db: Session):
    requests = repo.list_resource_requests(db)
    result = []
    for req in requests:
        items = []
        try:
            items = items_repo.get_items_by_request(db, req.request_id)
        except Exception:
            items = []
        result.append(_enrich_request(req, items))
    return result


def get_request(db: Session, request_id: UUID):
    req = repo.get_resource_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    items = []
    try:
        items = items_repo.get_items_by_request(db, request_id)
    except Exception:
        items = []
    return _enrich_request(req, items)


def update_request(db: Session, request_id: UUID, payload):
    row = repo.update_resource_request(db, request_id, payload)
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    if getattr(payload, "items", None):
        try:
            items_repo.create_items(db, request_id, payload.items)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    req = repo.get_resource_request(db, request_id)
    items = []
    try:
        items = items_repo.get_items_by_request(db, request_id)
    except Exception:
        items = []
    return _enrich_request(req, items)


def get_overdue(db: Session):
    follow_ups = follow_ups_repo.get_overdue(db, date.today())
    request_ids = list({fu.request_id for fu in follow_ups})
    result = []
    for rid in request_ids:
        try:
            result.append(get_request(db, rid))
        except Exception:
            continue
    return result
