import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
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
from models.enums import user_role_enum


class Department(Base):
    __tablename__ = "departments"

    department_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    department_name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    responsible_engineer_id = Column(UUID(as_uuid=True), nullable=True)
    responsible_engineer_role = Column(
        user_role_enum, nullable=False, server_default=text("'biomedical_engineer'")
    )
    is_active = Column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("department_name", name="departments_department_name_key"),
        CheckConstraint(
            "responsible_engineer_role = 'biomedical_engineer'",
            name="departments_responsible_engineer_role_check",
        ),
        ForeignKeyConstraint(
            ["responsible_engineer_id", "responsible_engineer_role"],
            ["users.user_id", "users.role"],
            name="fk_dept_engineer",
        ),
    )

    users = relationship(
        "User", back_populates="department", foreign_keys="User.department_id"
    )
    responsible_engineer = relationship(
        "User",
        primaryjoin="Department.responsible_engineer_id == User.user_id",
        foreign_keys=[responsible_engineer_id],
        viewonly=True,
    )
    equipment = relationship("Equipment", back_populates="department")
