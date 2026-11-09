from datetime import date, timedelta

from models import RequestFollowUp, ResourceRequest

TODAY = date.today()


def new_request(db, data):
    req = ResourceRequest(
        requested_by=data["engineer"].user_id,
        related_fault_id=data["fault"].fault_id,
        request_type="spare_parts",
        justification="Probe cable needed",
    )
    db.add(req)
    db.flush()
    return req


def new_follow_up(req, data, **kw):
    values = dict(
        request_id=req.request_id,
        organisation="Health Partners",
        channel="letter",
        sent_at=TODAY - timedelta(days=10),
        next_follow_up_date=TODAY - timedelta(days=1),
        logged_by=data["manager"].user_id,
    )
    values.update(kw)
    return RequestFollowUp(**values)


def test_request_follow_ups_has_all_columns(table):
    assert set(table("request_follow_ups").c.keys()) == {
        "follow_up_id",
        "request_id",
        "organisation",
        "channel",
        "sent_at",
        "next_follow_up_date",
        "reply_status",
        "reply_at",
        "note",
        "logged_by",
        "logged_by_role",
        "logged_at",
    }


def test_follow_up_constraints(checks, foreign_keys):
    assert {
        "request_follow_ups_channel_check",
        "request_follow_ups_reply_status_check",
        "request_follow_ups_next_follow_up_date_check",
        "request_follow_ups_logged_by_role_check",
        "ck_follow_ups_reply_date",
    } <= checks("request_follow_ups")
    assert foreign_keys("request_follow_ups")["fk_follow_up_manager"] == [
        "users.user_id",
        "users.role",
    ]


def test_manager_logs_a_follow_up(db, data):
    req = new_request(db, data)
    f = new_follow_up(req, data)
    db.add(f)
    db.flush()
    db.refresh(f)
    db.refresh(req)
    assert f.reply_status == "no_reply" and f.logged_at is not None
    assert f in req.follow_ups and f.logged_by_user.email == "meron@hospital.et"


def test_many_follow_ups_on_one_request(db, data):
    req = new_request(db, data)
    db.add_all(
        [
            new_follow_up(req, data),
            new_follow_up(req, data, organisation="MedTech PLC", channel="email"),
        ]
    )
    db.flush()
    db.refresh(req)
    assert len(req.follow_ups) == 2


def test_logging_a_reply(db, data):
    req = new_request(db, data)
    f = new_follow_up(req, data)
    db.add(f)
    db.flush()
    f.reply_status = "accepted"
    f.reply_at = TODAY
    db.flush()


def test_engineer_cannot_log_a_follow_up(db, data, refused):
    req = new_request(db, data)
    assert refused(
        lambda: db.add(new_follow_up(req, data, logged_by=data["engineer"].user_id))
    )


def test_bad_channel_is_refused(db, data, refused):
    req = new_request(db, data)
    assert refused(lambda: db.add(new_follow_up(req, data, channel="sms_from_waliin")))


def test_bad_reply_status_is_refused(db, data, refused):
    req = new_request(db, data)
    assert refused(
        lambda: db.add(new_follow_up(req, data, reply_status="maybe", reply_at=TODAY))
    )


def test_follow_up_date_before_sent_date_is_refused(db, data, refused):
    req = new_request(db, data)
    assert refused(
        lambda: db.add(
            new_follow_up(req, data, next_follow_up_date=TODAY - timedelta(days=20))
        )
    )


def test_overdue_requests_can_be_found(db, data):
    """Overdue = no reply and the follow-up date has passed (worked out when reading)."""
    from sqlalchemy import select

    req = new_request(db, data)
    db.add_all(
        [
            new_follow_up(req, data),  # overdue
            new_follow_up(
                req,
                data,
                organisation="On time",
                next_follow_up_date=TODAY + timedelta(days=5),
            ),
            new_follow_up(
                req,
                data,
                organisation="Replied",
                reply_status="accepted",
                reply_at=TODAY,
            ),
        ]
    )
    db.flush()
    overdue = db.scalars(
        select(RequestFollowUp.organisation).where(
            RequestFollowUp.reply_status == "no_reply",
            RequestFollowUp.next_follow_up_date < TODAY,
        )
    ).all()
    assert overdue == ["Health Partners"]


def test_reply_without_reply_date_is_refused(db, data, refused):
    req = new_request(db, data)
    assert refused(lambda: db.add(new_follow_up(req, data, reply_status="accepted")))


def test_no_reply_with_a_reply_date_is_refused(db, data, refused):
    req = new_request(db, data)
    assert refused(
        lambda: db.add(
            new_follow_up(req, data, reply_status="no_reply", reply_at=TODAY)
        )
    )
