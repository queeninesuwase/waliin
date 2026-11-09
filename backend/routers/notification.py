from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas.notification import NotificationCreate, NotificationRead
from security.dependencies import get_current_user
from services.notification import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])
svc = NotificationService()

LoggedIn = Annotated[User, Depends(get_current_user)]


@router.post("/", response_model=NotificationRead, status_code=201)
def create(data: NotificationCreate, user: LoggedIn, db: Session = Depends(get_db)):
    return svc.create(db, data)


# Both URLs return only the logged-in user's notifications.
# Keep these above "/{id}", or "me" gets read as a UUID and fails.
@router.get("/me", response_model=list[NotificationRead])
@router.get("/", response_model=list[NotificationRead])
def list_mine(user: LoggedIn, db: Session = Depends(get_db)):
    return svc.list_by_recipient(db, user.user_id)


@router.get("/{id}", response_model=NotificationRead)
def get_one(id: UUID, user: LoggedIn, db: Session = Depends(get_db)):
    return svc.get_for_user(db, id, user.user_id)


@router.post("/{id}/read", response_model=NotificationRead)
def mark_read(id: UUID, user: LoggedIn, db: Session = Depends(get_db)):
    return svc.mark_read(db, id, user.user_id)
