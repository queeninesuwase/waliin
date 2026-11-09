from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from models.resource_request import ResourceRequest


def create_resource_request(db: Session, requested_by: UUID, payload):
    req = ResourceRequest(
        requested_by=requested_by,
        request_type=payload.request_type,
        justification=payload.justification,
        related_fault_id=getattr(payload, "related_fault_id", None),
        status="pending",
    )
    db.add(req)
    db.flush()
    return req.request_id


def get_resource_request(db: Session, request_id: UUID):
    return (
        db.query(ResourceRequest)
        .filter(ResourceRequest.request_id == request_id)
        .first()
    )


def list_resource_requests(db: Session):
    return db.query(ResourceRequest).all()


def decide_resource_request(db: Session, request_id: UUID, payload):
    req = (
        db.query(ResourceRequest)
        .filter(ResourceRequest.request_id == request_id)
        .first()
    )
    if not req:
        return None
    status = getattr(payload, "approval_status")
    # Map to DB allowed values
    if status and status.lower() == "approved":
        status = "approved"
    elif status and status.lower() == "rejected":
        status = "rejected"
    elif status and status.lower() == "returned":
        status = "returned"
    req.status = status
    req.decision_by = getattr(payload, "manager_id", None)
    req.decision_reason = getattr(payload, "decision_reason", None)
    req.decided_at = func.now()
    db.flush()
    return req


def update_resource_request(db: Session, request_id: UUID, payload):
    req = (
        db.query(ResourceRequest)
        .filter(ResourceRequest.request_id == request_id)
        .first()
    )
    if not req:
        return None
    if getattr(payload, "request_type", None) is not None:
        req.request_type = payload.request_type
    if getattr(payload, "justification", None) is not None:
        req.justification = payload.justification
    if getattr(payload, "related_fault_id", None) is not None:
        req.related_fault_id = payload.related_fault_id
    db.flush()
    return req
