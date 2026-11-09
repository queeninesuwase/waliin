from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from models.request_follow_up import RequestFollowUp


def create_follow_up(db: Session, request_id: UUID, logged_by: UUID, payload):
    sent_at = (
        getattr(payload, "sent_date", None)
        or getattr(payload, "sent_at", None)
        or date.today()
    )
    fu = RequestFollowUp(
        request_id=request_id,
        organisation=payload.organisation,
        channel=payload.channel,
        sent_at=sent_at,
        next_follow_up_date=getattr(payload, "next_follow_up_date", None),
        note=getattr(payload, "note", None),
        logged_by=logged_by,
        logged_by_role="health_manager",
        reply_status="no_reply",
    )
    db.add(fu)
    db.flush()
    db.refresh(fu)
    return fu


def get_follow_ups_by_request(db: Session, request_id: UUID):
    return (
        db.query(RequestFollowUp)
        .filter(RequestFollowUp.request_id == request_id)
        .order_by(RequestFollowUp.sent_at.desc())
        .all()
    )


def get_follow_up(db: Session, follow_up_id: UUID):
    return (
        db.query(RequestFollowUp)
        .filter(RequestFollowUp.follow_up_id == follow_up_id)
        .first()
    )


def log_reply(db: Session, follow_up_id: UUID, payload):
    fu = get_follow_up(db, follow_up_id)
    if not fu:
        return None
    reply_status = getattr(payload, "reply_status", None)
    reply_at = getattr(payload, "reply_at", None)
    if reply_status:
        fu.reply_status = reply_status
    if reply_at is not None:
        fu.reply_at = reply_at
    if getattr(payload, "note", None) is not None:
        fu.note = payload.note
    db.flush()
    db.refresh(fu)
    return fu


def update_follow_up(db: Session, follow_up_id: UUID, payload):
    fu = get_follow_up(db, follow_up_id)
    if not fu:
        return None
    for field in ["organisation", "channel", "note", "reply_status"]:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(fu, field, val)
    for field in ["sent_at", "next_follow_up_date", "reply_at"]:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(fu, field, val)
    # also handle sent_date
    if getattr(payload, "sent_date", None) is not None:
        fu.sent_at = payload.sent_date
    db.flush()
    db.refresh(fu)
    return fu


def get_overdue(db: Session, today: date):
    return (
        db.query(RequestFollowUp)
        .filter(RequestFollowUp.reply_status == "no_reply")
        .filter(RequestFollowUp.next_follow_up_date < today)
        .all()
    )
