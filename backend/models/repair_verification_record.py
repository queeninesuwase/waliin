import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database import Base
from models.enums import RecordType, TestResult, check_in, user_role_enum


TEST_TYPES_SQL = "'functional_test', 'safety_test', 'calibration', 'performance_test', 'commissioning'"


class RepairVerificationRecord(Base):
    __tablename__ = "repair_verification_records"

    record_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )

    fault_id = Column(UUID(as_uuid=True), nullable=False)
    equipment_id = Column(UUID(as_uuid=True), nullable=False)
    record_type = Column(String(30), nullable=False)
    performed_by = Column(UUID(as_uuid=True), nullable=False)
    performed_by_role = Column(
        user_role_enum, nullable=False, server_default=text("'biomedical_engineer'")
    )
    work_performed = Column(Text, nullable=True)
    parts_used = Column(Text, nullable=True)
    repair_started_at = Column(DateTime(timezone=True), nullable=True)
    repair_completed_at = Column(DateTime(timezone=True), nullable=True)
    test_result = Column(String(20), nullable=True)
    test_details = Column(Text, nullable=True)

    authorized_for_service = Column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    performed_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    released_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        ForeignKeyConstraint(
            ["fault_id", "equipment_id"],
            ["faults.fault_id", "faults.equipment_id"],
            name="fk_record_fault_equipment",
        ),
        ForeignKeyConstraint(
            ["performed_by", "performed_by_role"],
            ["users.user_id", "users.role"],
            name="fk_record_engineer",
        ),
        CheckConstraint(
            check_in("record_type", RecordType),
            name="repair_verification_records_record_type_check",
        ),
        CheckConstraint(
            "performed_by_role = 'biomedical_engineer'",
            name="repair_verification_records_performed_by_role_check",
        ),
        CheckConstraint(
            check_in("test_result", TestResult),
            name="repair_verification_records_test_result_check",
        ),
        CheckConstraint(
            "(released_at IS NOT NULL) = authorized_for_service",
            name="ck_record_release_pair",
        ),
        CheckConstraint(
            "NOT authorized_for_service OR record_type = 'release'",
            name="ck_record_release_type",
        ),
        CheckConstraint(
            f"record_type NOT IN ({TEST_TYPES_SQL}) OR COALESCE(test_result IN ('pass', 'fail'), FALSE)",
            name="ck_record_test_result",
        ),
        CheckConstraint(
            "record_type <> 'repair' OR work_performed IS NOT NULL",
            name="ck_record_repair_work",
        ),
        CheckConstraint(
            "repair_completed_at IS NULL OR repair_started_at IS NULL "
            "OR repair_completed_at >= repair_started_at",
            name="ck_record_repair_dates",
        ),
        Index(
            "uq_record_one_release",
            "fault_id",
            unique=True,
            postgresql_where=text("authorized_for_service"),
        ),
    )

    fault = relationship(
        "Fault", back_populates="records", foreign_keys=[fault_id, equipment_id]
    )
    performed_by_user = relationship(
        "User",
        primaryjoin="RepairVerificationRecord.performed_by == User.user_id",
        foreign_keys=[performed_by],
        viewonly=True,
    )
