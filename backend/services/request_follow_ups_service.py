from datetime import date
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from repositories import request_follow_ups_repo as repo


def log_follow_up(db: Session, request_id: UUID, manager_id: UUID, payload):
    return repo.create_follow_up(db, request_id, manager_id, payload)


def log_follow_up_manager(
    db: Session, request_id: UUID, manager_id, x_user_role, payload
):
    if x_user_role != "health_manager":
        raise HTTPException(
            status_code=403, detail="Only health managers can log follow-ups"
        )
    if manager_id is None:
        raise HTTPException(status_code=400, detail="manager_id required")
    return log_follow_up(db, request_id, manager_id, payload)


def get_follow_ups(db: Session, request_id: UUID):
    return repo.get_follow_ups_by_request(db, request_id)


def log_reply(db: Session, follow_up_id: UUID, payload):
    fu = repo.log_reply(db, follow_up_id, payload)
    if not fu:
        raise HTTPException(status_code=404, detail="Follow up not found")
    return fu


def update_follow_up(db: Session, follow_up_id: UUID, payload):
    fu = repo.update_follow_up(db, follow_up_id, payload)
    if not fu:
        raise HTTPException(status_code=404, detail="Follow up not found")
    return fu


def get_overdue(db: Session):
    today = date.today()
    result = repo.get_overdue(db, today)
    if not result:
        return []
    return result
