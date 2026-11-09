from models import Notification


def new_notification(data, **kw):
    values = dict(
        recipient_user_id=data["nurse"].user_id,
        related_fault_id=data["fault"].fault_id,
        notification_type="fault_status_changed",
        message="Your report is in repair",
    )
    values.update(kw)
    return Notification(**values)


def test_notification_constraints(checks):
    assert {
        "notifications_notification_type_check",
        "notifications_channel_check",
    } <= checks("notifications")


def test_notification_is_in_app_by_default(db, data):
    n = new_notification(data)
    db.add(n)
    db.flush()
    db.refresh(n)
    assert n.channel == "in_app" and n.read_at is None
    assert n in data["nurse"].notifications


def test_email_channel_is_refused(db, data, refused):
    assert refused(lambda: db.add(new_notification(data, channel="email")))


def test_bad_notification_type_is_refused(db, data, refused):
    assert refused(lambda: db.add(new_notification(data, notification_type="hello")))
