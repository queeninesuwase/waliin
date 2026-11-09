from models.notification import Notification


class NotificationRepository:
    def get(self, db, nid):
        return (
            db.query(Notification).filter(Notification.notification_id == nid).first()
        )

    def list(self, db, skip=0, limit=100):
        return db.query(Notification).offset(skip).limit(limit).all()

    def list_by_recipient(self, db, recipient_id):
        return (
            db.query(Notification)
            .filter(Notification.recipient_user_id == recipient_id)
            .all()
        )

    def create(self, db, n):
        db.add(n)
        db.flush()
        db.refresh(n)
        return n

    def mark_read(self, db, n):
        from datetime import datetime, timezone

        n.read_at = datetime.now(timezone.utc)
        db.flush()
        db.refresh(n)
        return n

    def commit(self, db):
        db.commit()

    def rollback(self, db):
        db.rollback()

    def refresh(self, db, i):
        db.refresh(i)
