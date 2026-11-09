import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database import Base
from models.enums import (
    AcquisitionType,
    InstallationStatus,
    RegistrationStatus,
    ServiceStatus,
    check_in,
    user_role_enum,
)


class Equipment(Base):
    __tablename__ = "equipment"

    equipment_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    manufacturer = Column(String(120), nullable=False)
    model_name = Column(String(120), nullable=False)
    model_number = Column(String(80), nullable=True)
    equipment_category = Column(String(100), nullable=False)
    department_id = Column(
        UUID(as_uuid=True),
        ForeignKey("departments.department_id", name="equipment_department_id_fkey"),
        nullable=False,
    )
    asset_tag = Column(String(80), nullable=False)
    serial_number = Column(String(120), nullable=True)
    location = Column(String(160), nullable=False)
    acquisition_type = Column(String(20), nullable=False)
    donor_or_supplier = Column(String(180), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    registration_status = Column(
        String(20),
        nullable=False,
        default=RegistrationStatus.PENDING.value,
        server_default=text("'pending'"),
    )
    installation_status = Column(
        String(25),
        nullable=False,
        default=InstallationStatus.UNKNOWN.value,
        server_default=text("'unknown'"),
    )

    service_status = Column(
        String(25),
        nullable=False,
        default=ServiceStatus.NOT_ASSESSED.value,
        server_default=text("'not_assessed'"),
    )
    warranty_start_date = Column(Date, nullable=True)
    warranty_end_date = Column(Date, nullable=True)
    registered_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", name="equipment_registered_by_fkey"),
        nullable=False,
    )
    approved_by = Column(UUID(as_uuid=True), nullable=True)
    approved_by_role = Column(
        user_role_enum, nullable=False, server_default=text("'health_manager'")
    )
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("asset_tag", name="equipment_asset_tag_key"),
        CheckConstraint(
            check_in("acquisition_type", AcquisitionType),
            name="equipment_acquisition_type_check",
        ),
        CheckConstraint(
            check_in("registration_status", RegistrationStatus),
            name="equipment_registration_status_check",
        ),
        CheckConstraint(
            check_in("installation_status", InstallationStatus),
            name="equipment_installation_status_check",
        ),
        CheckConstraint(
            check_in("service_status", ServiceStatus),
            name="equipment_service_status_check",
        ),
        CheckConstraint(
            "approved_by_role = 'health_manager'",
            name="equipment_approved_by_role_check",
        ),
        ForeignKeyConstraint(
            ["approved_by", "approved_by_role"],
            ["users.user_id", "users.role"],
            name="fk_equipment_approver",
        ),
        CheckConstraint(
            "(registration_status = 'approved') = (approved_by IS NOT NULL AND approved_at IS NOT NULL)",
            name="ck_equipment_approval",
        ),
        CheckConstraint(
            "warranty_end_date IS NULL OR warranty_start_date IS NULL "
            "OR warranty_end_date >= warranty_start_date",
            name="ck_equipment_warranty_dates",
        ),
    )

    department = relationship("Department", back_populates="equipment")
    registered_by_user = relationship("User", foreign_keys=[registered_by])
    approved_by_user = relationship(
        "User",
        primaryjoin="Equipment.approved_by == User.user_id",
        foreign_keys=[approved_by],
        viewonly=True,
    )
    documents = relationship("EquipmentDocument", back_populates="equipment")
    faults = relationship("Fault", back_populates="equipment")
