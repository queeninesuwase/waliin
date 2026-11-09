import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
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


class User(Base):
    __tablename__ = "users"

    user_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )

    full_name = Column(String(120), nullable=True)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=True)
    role = Column(user_role_enum, nullable=False)

    department_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "departments.department_id", name="fk_users_department", use_alter=True
        ),
        nullable=True,
    )
    is_active = Column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )

    invited_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", name="users_invited_by_fkey"),
        nullable=True,
    )

    invitation_token_hash = Column(String(255), nullable=True)
    invitation_expires_at = Column(DateTime(timezone=True), nullable=True)
    invitation_accepted_at = Column(DateTime(timezone=True), nullable=True)

    reset_token_hash = Column(String(255), nullable=True)
    reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    mfa_enabled = Column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    mfa_secret_encrypted = Column(Text, nullable=True)

    token_version = Column(Integer, nullable=False, default=0, server_default=text("0"))

    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("email", name="users_email_key"),
        UniqueConstraint("user_id", "role", name="uq_users_id_role"),
        CheckConstraint("email = lower(btrim(email))", name="users_email_check"),
        CheckConstraint(
            "(password_hash IS NULL) = (invitation_accepted_at IS NULL)",
            name="ck_users_password_after_accept",
        ),
        CheckConstraint(
            "(full_name IS NULL) = (invitation_accepted_at IS NULL)",
            name="ck_users_name_after_accept",
        ),
        CheckConstraint(
            "role = 'health_manager' OR department_id IS NOT NULL",
            name="ck_users_department_required",
        ),
        CheckConstraint(
            "NOT mfa_enabled OR mfa_secret_encrypted IS NOT NULL",
            name="ck_users_mfa_secret",
        ),
        CheckConstraint(
            "(reset_token_hash IS NULL) = (reset_token_expires_at IS NULL)",
            name="ck_users_reset_pair",
        ),
        CheckConstraint("token_version >= 0", name="users_token_version_check"),
    )

    department = relationship(
        "Department", back_populates="users", foreign_keys=[department_id]
    )
    invited_by_user = relationship(
        "User", remote_side=[user_id], foreign_keys=[invited_by]
    )
    reported_faults = relationship(
        "Fault", back_populates="reported_by_user", foreign_keys="Fault.reported_by"
    )
    notifications = relationship("Notification", back_populates="recipient")
    audit_logs = relationship("AuditLog", back_populates="actor")
