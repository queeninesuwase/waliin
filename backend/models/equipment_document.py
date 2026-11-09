import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
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
from models.enums import DocumentType, check_in


class EquipmentDocument(Base):
    __tablename__ = "equipment_documents"

    document_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    equipment_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "equipment.equipment_id", name="equipment_documents_equipment_id_fkey"
        ),
        nullable=False,
    )
    document_type = Column(String(40), nullable=False)
    document_name = Column(String(180), nullable=False)
    storage_key = Column(Text, nullable=False)
    document_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    uploaded_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", name="equipment_documents_uploaded_by_fkey"),
        nullable=False,
    )
    uploaded_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            check_in("document_type", DocumentType),
            name="equipment_documents_document_type_check",
        ),
    )

    equipment = relationship("Equipment", back_populates="documents")
    uploaded_by_user = relationship("User", foreign_keys=[uploaded_by])
