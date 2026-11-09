import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from database import Base
from models.enums import AuditEntityType, check_in


class AuditLog(Base):
    __tablename__ = "audit_logs"

    audit_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    actor_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", name="audit_logs_actor_user_id_fkey"),
        nullable=True,
    )
    action = Column(String(80), nullable=False)
    entity_type = Column(String(60), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    details = Column(JSONB, nullable=True)
    occurred_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            check_in("entity_type", AuditEntityType),
            name="audit_logs_entity_type_check",
        ),
    )

    actor = relationship("User", back_populates="audit_logs")
