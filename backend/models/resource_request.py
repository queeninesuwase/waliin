import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
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
from models.enums import RequestStatus, RequestType, check_in, user_role_enum


class ResourceRequest(Base):
    __tablename__ = "resource_requests"

    request_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    requested_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", name="resource_requests_requested_by_fkey"),
        nullable=False,
    )
    related_fault_id = Column(
        UUID(as_uuid=True),
        ForeignKey("faults.fault_id", name="resource_requests_related_fault_id_fkey"),
        nullable=True,
    )
    request_type = Column(String(30), nullable=False)
    justification = Column(Text, nullable=False)
    status = Column(
        String(20),
        nullable=False,
        default=RequestStatus.PENDING.value,
        server_default=text("'pending'"),
    )
    decision_by = Column(UUID(as_uuid=True), nullable=True)
    decision_by_role = Column(
        user_role_enum, nullable=False, server_default=text("'health_manager'")
    )
    decision_reason = Column(Text, nullable=True)
    requested_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    decided_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            check_in("request_type", RequestType),
            name="resource_requests_request_type_check",
        ),
        CheckConstraint(
            check_in("status", RequestStatus), name="resource_requests_status_check"
        ),
        CheckConstraint(
            "decision_by_role = 'health_manager'",
            name="resource_requests_decision_by_role_check",
        ),
        # Only a health manager can decide a request.
        ForeignKeyConstraint(
            ["decision_by", "decision_by_role"],
            ["users.user_id", "users.role"],
            name="fk_request_decider",
        ),
        CheckConstraint(
            "status = 'pending' OR (decision_by IS NOT NULL AND decided_at IS NOT NULL)",
            name="ck_request_decided",
        ),
        CheckConstraint(
            "(status = 'resolved') = (resolved_at IS NOT NULL)",
            name="ck_request_resolved",
        ),
    )

    requested_by_user = relationship("User", foreign_keys=[requested_by])

    decision_by_user = relationship(
        "User",
        primaryjoin="ResourceRequest.decision_by == User.user_id",
        foreign_keys=[decision_by],
        viewonly=True,
    )
    related_fault = relationship("Fault", back_populates="resource_requests")
    items = relationship(
        "RequestItem", back_populates="request", cascade="all, delete-orphan"
    )
    follow_ups = relationship(
        "RequestFollowUp", back_populates="request", order_by="RequestFollowUp.sent_at"
    )
