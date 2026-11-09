"""Add MFA verification tracking and recovery codes.

Revision ID: 0003
Revises: 0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0003"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("mfa_last_used_step", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "mfa_failed_attempts",
            sa.SmallInteger(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column("mfa_locked_until", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_check_constraint(
        "users_mfa_failed_attempts_check",
        "users",
        "mfa_failed_attempts >= 0",
    )

    op.create_table(
        "mfa_recovery_codes",
        sa.Column(
            "code_id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.user_id"],
            name="mfa_recovery_codes_user_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("code_id"),
    )

    op.create_index(
        "ix_mfa_recovery_codes_user_id",
        "mfa_recovery_codes",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_mfa_recovery_codes_user_id",
        table_name="mfa_recovery_codes",
    )
    op.drop_table("mfa_recovery_codes")

    op.drop_constraint(
        "users_mfa_failed_attempts_check",
        "users",
        type_="check",
    )
    op.drop_column("users", "mfa_locked_until")
    op.drop_column("users", "mfa_failed_attempts")
    op.drop_column("users", "mfa_last_used_step")
