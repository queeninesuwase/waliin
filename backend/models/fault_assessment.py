import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database import Base
from models.enums import PriorityLevel, check_in, user_role_enum


class FaultAssessment(Base):
    __tablename__ = "fault_assessments"

    assessment_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    fault_id = Column(
        UUID(as_uuid=True),
        ForeignKey("faults.fault_id", name="fault_assessments_fault_id_fkey"),
        nullable=False,
    )
    assessed_by = Column(UUID(as_uuid=True), nullable=False)
    assessed_by_role = Column(
        user_role_enum, nullable=False, server_default=text("'biomedical_engineer'")
    )
    assessed_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    findings = Column(Text, nullable=False)
    condition = Column(String(80), nullable=False)
    recommended_action = Column(Text, nullable=False)

    severity_factor = Column(SmallInteger, nullable=False)
    clinical_criticality = Column(SmallInteger, nullable=False)
    backup_available = Column(Boolean, nullable=False)
    history_factor = Column(SmallInteger, nullable=False)

    priority_score = Column(SmallInteger, nullable=False)
    rule_priority_level = Column(String(15), nullable=False)

    priority_level = Column(String(15), nullable=False)

    priority_explanation = Column(Text, nullable=False)
    rule_version = Column(String(40), nullable=False)
    is_current = Column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )

    __table_args__ = (
        CheckConstraint(
            "assessed_by_role = 'biomedical_engineer'",
            name="fault_assessments_assessed_by_role_check",
        ),
        ForeignKeyConstraint(
            ["assessed_by", "assessed_by_role"],
            ["users.user_id", "users.role"],
            name="fk_assessment_engineer",
        ),
        CheckConstraint(
            "severity_factor BETWEEN 1 AND 4",
            name="fault_assessments_severity_factor_check",
        ),
        CheckConstraint(
            "clinical_criticality BETWEEN 1 AND 3",
            name="fault_assessments_clinical_criticality_check",
        ),
        CheckConstraint(
            "history_factor BETWEEN 0 AND 3",
            name="fault_assessments_history_factor_check",
        ),
        CheckConstraint(
            "priority_score BETWEEN 2 AND 12",
            name="fault_assessments_priority_score_check",
        ),
        CheckConstraint(
            check_in("rule_priority_level", PriorityLevel),
            name="fault_assessments_rule_priority_level_check",
        ),
        CheckConstraint(
            check_in("priority_level", PriorityLevel),
            name="fault_assessments_priority_level_check",
        ),
        CheckConstraint(
            "length(btrim(priority_explanation)) > 0", name="ck_assessment_explanation"
        ),
        Index(
            "uq_assessment_current",
            "fault_id",
            unique=True,
            postgresql_where=text("is_current"),
        ),
    )

    fault = relationship("Fault", back_populates="assessments")
    assessed_by_user = relationship(
        "User",
        primaryjoin="FaultAssessment.assessed_by == User.user_id",
        foreign_keys=[assessed_by],
        viewonly=True,
    )
