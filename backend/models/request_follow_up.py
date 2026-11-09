import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database import Base
from models.enums import FollowUpChannel, ReplyStatus, check_in, user_role_enum


class RequestFollowUp(Base):
    """The health manager's record of one contact with a donor, supplier or nearby hospital.

    Waliin does not contact them: the manager sends the PDF request report outside Waliin
    and logs each contact and reply here. A request is overdue when reply_status is
    'no_reply' and next_follow_up_date is before today (worked out when the data is read).
    """

    __tablename__ = "request_follow_ups"

    follow_up_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    request_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "resource_requests.request_id", name="request_follow_ups_request_id_fkey"
        ),
        nullable=False,
    )
    organisation = Column(
        String(180), nullable=False
    )  # donor, supplier or hospital contacted
    channel = Column(
        String(20), nullable=False
    )  # how the manager sent it outside Waliin
    sent_at = Column(Date, nullable=False)
    next_follow_up_date = Column(Date, nullable=True)
    reply_status = Column(
        String(20),
        nullable=False,
        default=ReplyStatus.NO_REPLY.value,
        server_default=text("'no_reply'"),
    )
    reply_at = Column(Date, nullable=True)
    note = Column(Text, nullable=True)
    # Must be a health manager: checked by the composite foreign key below.
    logged_by = Column(UUID(as_uuid=True), nullable=False)
    logged_by_role = Column(
        user_role_enum, nullable=False, server_default=text("'health_manager'")
    )
    logged_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            check_in("channel", FollowUpChannel),
            name="request_follow_ups_channel_check",
        ),
        CheckConstraint(
            check_in("reply_status", ReplyStatus),
            name="request_follow_ups_reply_status_check",
        ),
        CheckConstraint(
            "next_follow_up_date >= sent_at",
            name="request_follow_ups_next_follow_up_date_check",
        ),
        # A reply date exists only when a reply was received.
        CheckConstraint(
            "(reply_status = 'no_reply') = (reply_at IS NULL)",
            name="ck_follow_ups_reply_date",
        ),
        CheckConstraint(
            "logged_by_role = 'health_manager'",
            name="request_follow_ups_logged_by_role_check",
        ),
        # Only a health manager can log a follow-up.
        ForeignKeyConstraint(
            ["logged_by", "logged_by_role"],
            ["users.user_id", "users.role"],
            name="fk_follow_up_manager",
        ),
    )

    # Relationships
    request = relationship("ResourceRequest", back_populates="follow_ups")
    # Read-only: set logged_by directly.
    logged_by_user = relationship(
        "User",
        primaryjoin="RequestFollowUp.logged_by == User.user_id",
        foreign_keys=[logged_by],
        viewonly=True,
    )
