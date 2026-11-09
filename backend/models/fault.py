import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database import Base
from models.enums import FaultSeverity, FaultStatus, check_in, user_role_enum


class Fault(Base):
    __tablename__ = "faults"

    fault_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    equipment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("equipment.equipment_id", name="faults_equipment_id_fkey"),
        nullable=False,
    )
    reported_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", name="faults_reported_by_fkey"),
        nullable=False,
    )
    client_report_id = Column(UUID(as_uuid=True), nullable=True)
    assigned_engineer_id = Column(UUID(as_uuid=True), nullable=True)
    assigned_engineer_role = Column(
        user_role_enum, nullable=False, server_default=text("'biomedical_engineer'")
    )
    description = Column(Text, nullable=False)
    severity = Column(String(15), nullable=False)
    status = Column(
        String(30),
        nullable=False,
        default=FaultStatus.REPORTED.value,
        server_default=text("'reported'"),
    )
    failure_observed_at = Column(DateTime(timezone=True), nullable=True)
    reported_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    out_of_service_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    closed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("client_report_id", name="faults_client_report_id_key"),
        UniqueConstraint("fault_id", "equipment_id", name="uq_fault_equipment"),
        CheckConstraint(
            "assigned_engineer_role = 'biomedical_engineer'",
            name="faults_assigned_engineer_role_check",
        ),
        ForeignKeyConstraint(
            ["assigned_engineer_id", "assigned_engineer_role"],
            ["users.user_id", "users.role"],
            name="fk_fault_engineer",
        ),
        CheckConstraint(
            check_in("severity", FaultSeverity), name="faults_severity_check"
        ),
        CheckConstraint(check_in("status", FaultStatus), name="faults_status_check"),
        CheckConstraint(
            "(status IN ('closed', 'cancelled')) = (closed_at IS NOT NULL)",
            name="ck_fault_closed_at",
        ),
        CheckConstraint(
            "status IN ('reported', 'cancelled') OR assigned_engineer_id IS NOT NULL",
            name="ck_fault_assigned",
        ),
    )

    equipment = relationship("Equipment", back_populates="faults")
    reported_by_user = relationship(
        "User", back_populates="reported_faults", foreign_keys=[reported_by]
    )

    assigned_engineer = relationship(
        "User",
        primaryjoin="Fault.assigned_engineer_id == User.user_id",
        foreign_keys=[assigned_engineer_id],
        viewonly=True,
    )
    status_history = relationship(
        "FaultStatusHistory",
        back_populates="fault",
        order_by="FaultStatusHistory.changed_at",
    )
    assessments = relationship(
        "FaultAssessment",
        back_populates="fault",
        order_by="FaultAssessment.assessed_at",
    )
    records = relationship(
        "RepairVerificationRecord",
        back_populates="fault",
        foreign_keys="[RepairVerificationRecord.fault_id, RepairVerificationRecord.equipment_id]",
        order_by="RepairVerificationRecord.performed_at",
    )
    resource_requests = relationship("ResourceRequest", back_populates="related_fault")
