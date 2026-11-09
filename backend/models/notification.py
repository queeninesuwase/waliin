import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database import Base
from models.enums import NotificationType, check_in


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    recipient_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", name="notifications_recipient_user_id_fkey"),
        nullable=False,
    )
    related_equipment_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "equipment.equipment_id", name="notifications_related_equipment_id_fkey"
        ),
        nullable=True,
    )
    related_fault_id = Column(
        UUID(as_uuid=True),
        ForeignKey("faults.fault_id", name="notifications_related_fault_id_fkey"),
        nullable=True,
    )
    related_request_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "resource_requests.request_id", name="notifications_related_request_id_fkey"
        ),
        nullable=True,
    )
    notification_type = Column(String(60), nullable=False)
    message = Column(Text, nullable=False)
    channel = Column(
        String(20), nullable=False, default="in_app", server_default=text("'in_app'")
    )
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    delivered_at = Column(
        DateTime(timezone=True), nullable=True
    )  # first shown on the device
    read_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            check_in("notification_type", NotificationType),
            name="notifications_notification_type_check",
        ),
        CheckConstraint("channel IN ('in_app')", name="notifications_channel_check"),
    )

    recipient = relationship("User", back_populates="notifications")
    related_equipment = relationship("Equipment")
    related_fault = relationship("Fault")
    related_request = relationship("ResourceRequest")
