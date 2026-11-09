from fastapi import HTTPException
from repositories.notification import NotificationRepository
from models.notification import Notification


class NotificationService:
    def __init__(self, repo=None):
        self.repo = repo or NotificationRepository()

    def create(self, db, data):
        n = Notification(**data.model_dump())
        created = self.repo.create(db, n)
        self.repo.commit(db)
        self.repo.refresh(db, created)
        return created

    def get(self, db, nid):
        n = self.repo.get(db, nid)
        if not n:
            raise HTTPException(status_code=404, detail="Notification not found")
        return n

    def get_for_user(self, db, nid, user_id):
        n = self.get(db, nid)
        if n.recipient_user_id != user_id:
            raise HTTPException(status_code=404, detail="Notification not found")
        return n

    def list(self, db, skip=0, limit=100):
        return self.repo.list(db, skip=skip, limit=limit)

    def list_by_recipient(self, db, rid):
        return self.repo.list_by_recipient(db, rid)

    def mark_read(self, db, nid, user_id):
        n = self.get_for_user(db, nid, user_id)
        return self.repo.mark_read(db, n)
