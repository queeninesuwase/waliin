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
from models.enums import FaultStatus, check_in


class FaultStatusHistory(Base):
    __tablename__ = "fault_status_history"

    history_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    fault_id = Column(
        UUID(as_uuid=True),
        ForeignKey("faults.fault_id", name="fault_status_history_fault_id_fkey"),
        nullable=False,
    )
    previous_status = Column(String(30), nullable=True)  # empty for the first event
    new_status = Column(String(30), nullable=False)
    changed_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", name="fault_status_history_changed_by_fkey"),
        nullable=True,
    )
    reason = Column(Text, nullable=True)
    changed_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            check_in("previous_status", FaultStatus),
            name="fault_status_history_previous_status_check",
        ),
        CheckConstraint(
            check_in("new_status", FaultStatus),
            name="fault_status_history_new_status_check",
        ),
        CheckConstraint(
            "previous_status IS DISTINCT FROM new_status", name="ck_history_changed"
        ),
    )

    fault = relationship("Fault", back_populates="status_history")
    changed_by_user = relationship("User", foreign_keys=[changed_by])
