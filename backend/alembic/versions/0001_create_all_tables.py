"""Create all Waliin tables (13), the user_role type, triggers and the fault_downtime view

Revision ID: 0001
Revises:
Create Date: 2026-10-24 14:13:45.367813
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# The user_role type is created once below; tables only use it.
USER_ROLE = postgresql.ENUM(
    "clinical_staff",
    "biomedical_engineer",
    "health_manager",
    name="user_role",
    create_type=False,
)

SET_UPDATED_AT_SQL = """
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
"""

# Release rule: the LATEST functional_test and the LATEST safety_test for the
# fault must both be 'pass' before a release record is saved.
CHECK_RELEASE_TESTS_SQL = """
CREATE OR REPLACE FUNCTION check_release_tests() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  t TEXT;
  latest TEXT;
BEGIN
  IF NEW.authorized_for_service THEN
    FOREACH t IN ARRAY ARRAY['functional_test', 'safety_test'] LOOP
      SELECT test_result INTO latest
        FROM repair_verification_records
       WHERE fault_id = NEW.fault_id AND record_type = t
         AND performed_at <= NEW.released_at
       ORDER BY performed_at DESC
       LIMIT 1;
      IF latest IS DISTINCT FROM 'pass' THEN
        RAISE EXCEPTION 'Cannot release fault %: latest % is %', NEW.fault_id, t,
          coalesce(latest, 'missing')
          USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
"""

FAULT_DOWNTIME_VIEW_SQL = """
CREATE VIEW fault_downtime AS
SELECT f.fault_id,
       f.equipment_id,
       f.out_of_service_at,
       r.released_at,
       COALESCE(r.released_at, now()) - f.out_of_service_at AS downtime,
       (r.released_at IS NULL)                              AS still_down
  FROM faults f
  LEFT JOIN repair_verification_records r
         ON r.fault_id = f.fault_id AND r.authorized_for_service
 WHERE f.out_of_service_at IS NOT NULL;
"""

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 0. Extension, role type and the updated_at helper
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")  # gen_random_uuid()
    op.execute(
        "CREATE TYPE user_role AS ENUM ('clinical_staff', 'biomedical_engineer', 'health_manager')"
    )
    op.execute(SET_UPDATED_AT_SQL)

    # 1. Tables
    op.create_table(
        "users",
        sa.Column(
            "user_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("full_name", sa.String(length=120), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("role", USER_ROLE, nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column("invited_by", sa.UUID(), nullable=True),
        sa.Column("invitation_token_hash", sa.String(length=255), nullable=True),
        sa.Column("invitation_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invitation_accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reset_token_hash", sa.String(length=255), nullable=True),
        sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "mfa_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("mfa_secret_encrypted", sa.Text(), nullable=True),
        sa.Column(
            "token_version", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role = 'health_manager' OR department_id IS NOT NULL",
            name="ck_users_department_required",
        ),
        sa.CheckConstraint(
            "(full_name IS NULL) = (invitation_accepted_at IS NULL)",
            name="ck_users_name_after_accept",
        ),
        sa.CheckConstraint(
            "(password_hash IS NULL) = (invitation_accepted_at IS NULL)",
            name="ck_users_password_after_accept",
        ),
        sa.CheckConstraint(
            "(reset_token_hash IS NULL) = (reset_token_expires_at IS NULL)",
            name="ck_users_reset_pair",
        ),
        sa.CheckConstraint(
            "NOT mfa_enabled OR mfa_secret_encrypted IS NOT NULL",
            name="ck_users_mfa_secret",
        ),
        sa.CheckConstraint("email = lower(btrim(email))", name="users_email_check"),
        sa.CheckConstraint("token_version >= 0", name="users_token_version_check"),
        sa.ForeignKeyConstraint(
            ["invited_by"], ["users.user_id"], name="users_invited_by_fkey"
        ),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("email", name="users_email_key"),
        sa.UniqueConstraint("user_id", "role", name="uq_users_id_role"),
    )
    op.create_table(
        "audit_logs",
        sa.Column(
            "audit_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("actor_user_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=60), nullable=False),
        sa.Column("entity_id", sa.UUID(), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "entity_type IN ('user', 'department', 'equipment', 'equipment_document', 'fault', 'fault_assessment', 'repair_verification_record', 'resource_request', 'notification')",
            name="audit_logs_entity_type_check",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"], ["users.user_id"], name="audit_logs_actor_user_id_fkey"
        ),
        sa.PrimaryKeyConstraint("audit_id"),
    )
    op.create_table(
        "departments",
        sa.Column(
            "department_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("department_name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("responsible_engineer_id", sa.UUID(), nullable=True),
        sa.Column(
            "responsible_engineer_role",
            USER_ROLE,
            server_default=sa.text("'biomedical_engineer'"),
            nullable=False,
        ),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "responsible_engineer_role = 'biomedical_engineer'",
            name="departments_responsible_engineer_role_check",
        ),
        sa.ForeignKeyConstraint(
            ["responsible_engineer_id", "responsible_engineer_role"],
            ["users.user_id", "users.role"],
            name="fk_dept_engineer",
        ),
        sa.PrimaryKeyConstraint("department_id"),
        sa.UniqueConstraint("department_name", name="departments_department_name_key"),
    )
    op.create_table(
        "equipment",
        sa.Column(
            "equipment_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("manufacturer", sa.String(length=120), nullable=False),
        sa.Column("model_name", sa.String(length=120), nullable=False),
        sa.Column("model_number", sa.String(length=80), nullable=True),
        sa.Column("equipment_category", sa.String(length=100), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("asset_tag", sa.String(length=80), nullable=False),
        sa.Column("serial_number", sa.String(length=120), nullable=True),
        sa.Column("location", sa.String(length=160), nullable=False),
        sa.Column("acquisition_type", sa.String(length=20), nullable=False),
        sa.Column("donor_or_supplier", sa.String(length=180), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "registration_status",
            sa.String(length=20),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column(
            "installation_status",
            sa.String(length=25),
            server_default=sa.text("'unknown'"),
            nullable=False,
        ),
        sa.Column(
            "service_status",
            sa.String(length=25),
            server_default=sa.text("'not_assessed'"),
            nullable=False,
        ),
        sa.Column("warranty_start_date", sa.Date(), nullable=True),
        sa.Column("warranty_end_date", sa.Date(), nullable=True),
        sa.Column("registered_by", sa.UUID(), nullable=False),
        sa.Column("approved_by", sa.UUID(), nullable=True),
        sa.Column(
            "approved_by_role",
            USER_ROLE,
            server_default=sa.text("'health_manager'"),
            nullable=False,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(registration_status = 'approved') = (approved_by IS NOT NULL AND approved_at IS NOT NULL)",
            name="ck_equipment_approval",
        ),
        sa.CheckConstraint(
            "acquisition_type IN ('donated', 'purchased', 'transferred', 'unknown', 'other')",
            name="equipment_acquisition_type_check",
        ),
        sa.CheckConstraint(
            "approved_by_role = 'health_manager'",
            name="equipment_approved_by_role_check",
        ),
        sa.CheckConstraint(
            "installation_status IN ('unknown', 'not_installed', 'partially_installed', 'installed', 'commissioned')",
            name="equipment_installation_status_check",
        ),
        sa.CheckConstraint(
            "registration_status IN ('pending', 'approved', 'returned')",
            name="equipment_registration_status_check",
        ),
        sa.CheckConstraint(
            "service_status IN ('not_assessed', 'in_service', 'out_of_service', 'under_maintenance', 'not_installed', 'incomplete', 'retired')",
            name="equipment_service_status_check",
        ),
        sa.CheckConstraint(
            "warranty_end_date IS NULL OR warranty_start_date IS NULL OR warranty_end_date >= warranty_start_date",
            name="ck_equipment_warranty_dates",
        ),
        sa.ForeignKeyConstraint(
            ["approved_by", "approved_by_role"],
            ["users.user_id", "users.role"],
            name="fk_equipment_approver",
        ),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["departments.department_id"],
            name="equipment_department_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["registered_by"], ["users.user_id"], name="equipment_registered_by_fkey"
        ),
        sa.PrimaryKeyConstraint("equipment_id"),
        sa.UniqueConstraint("asset_tag", name="equipment_asset_tag_key"),
    )
    op.create_table(
        "equipment_documents",
        sa.Column(
            "document_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("equipment_id", sa.UUID(), nullable=False),
        sa.Column("document_type", sa.String(length=40), nullable=False),
        sa.Column("document_name", sa.String(length=180), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("document_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("uploaded_by", sa.UUID(), nullable=False),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "document_type IN ('photo', 'manual', 'warranty', 'donation_letter', 'delivery_note', 'installation_report', 'calibration_certificate', 'other')",
            name="equipment_documents_document_type_check",
        ),
        sa.ForeignKeyConstraint(
            ["equipment_id"],
            ["equipment.equipment_id"],
            name="equipment_documents_equipment_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"],
            ["users.user_id"],
            name="equipment_documents_uploaded_by_fkey",
        ),
        sa.PrimaryKeyConstraint("document_id"),
    )
    op.create_table(
        "faults",
        sa.Column(
            "fault_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("equipment_id", sa.UUID(), nullable=False),
        sa.Column("reported_by", sa.UUID(), nullable=False),
        sa.Column("client_report_id", sa.UUID(), nullable=True),
        sa.Column("assigned_engineer_id", sa.UUID(), nullable=True),
        sa.Column(
            "assigned_engineer_role",
            USER_ROLE,
            server_default=sa.text("'biomedical_engineer'"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=15), nullable=False),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default=sa.text("'reported'"),
            nullable=False,
        ),
        sa.Column("failure_observed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "reported_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("out_of_service_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(status IN ('closed', 'cancelled')) = (closed_at IS NOT NULL)",
            name="ck_fault_closed_at",
        ),
        sa.CheckConstraint(
            "assigned_engineer_role = 'biomedical_engineer'",
            name="faults_assigned_engineer_role_check",
        ),
        sa.CheckConstraint(
            "severity IN ('low', 'medium', 'high', 'critical')",
            name="faults_severity_check",
        ),
        sa.CheckConstraint(
            "status IN ('reported', 'assigned', 'under_inspection', 'awaiting_resources', 'under_repair', 'awaiting_verification', 'verified', 'closed', 'cancelled')",
            name="faults_status_check",
        ),
        sa.CheckConstraint(
            "status IN ('reported', 'cancelled') OR assigned_engineer_id IS NOT NULL",
            name="ck_fault_assigned",
        ),
        sa.ForeignKeyConstraint(
            ["assigned_engineer_id", "assigned_engineer_role"],
            ["users.user_id", "users.role"],
            name="fk_fault_engineer",
        ),
        sa.ForeignKeyConstraint(
            ["equipment_id"],
            ["equipment.equipment_id"],
            name="faults_equipment_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["reported_by"], ["users.user_id"], name="faults_reported_by_fkey"
        ),
        sa.PrimaryKeyConstraint("fault_id"),
        sa.UniqueConstraint("client_report_id", name="faults_client_report_id_key"),
        sa.UniqueConstraint("fault_id", "equipment_id", name="uq_fault_equipment"),
    )
    op.create_table(
        "fault_assessments",
        sa.Column(
            "assessment_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("fault_id", sa.UUID(), nullable=False),
        sa.Column("assessed_by", sa.UUID(), nullable=False),
        sa.Column(
            "assessed_by_role",
            USER_ROLE,
            server_default=sa.text("'biomedical_engineer'"),
            nullable=False,
        ),
        sa.Column(
            "assessed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("findings", sa.Text(), nullable=False),
        sa.Column("condition", sa.String(length=80), nullable=False),
        sa.Column("recommended_action", sa.Text(), nullable=False),
        sa.Column("severity_factor", sa.SmallInteger(), nullable=False),
        sa.Column("clinical_criticality", sa.SmallInteger(), nullable=False),
        sa.Column("backup_available", sa.Boolean(), nullable=False),
        sa.Column("history_factor", sa.SmallInteger(), nullable=False),
        sa.Column("priority_score", sa.SmallInteger(), nullable=False),
        sa.Column("rule_priority_level", sa.String(length=15), nullable=False),
        sa.Column("priority_level", sa.String(length=15), nullable=False),
        sa.Column("priority_explanation", sa.Text(), nullable=False),
        sa.Column("rule_version", sa.String(length=40), nullable=False),
        sa.Column(
            "is_current", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.CheckConstraint(
            "assessed_by_role = 'biomedical_engineer'",
            name="fault_assessments_assessed_by_role_check",
        ),
        sa.CheckConstraint(
            "priority_level IN ('low', 'medium', 'high', 'critical')",
            name="fault_assessments_priority_level_check",
        ),
        sa.CheckConstraint(
            "clinical_criticality BETWEEN 1 AND 3",
            name="fault_assessments_clinical_criticality_check",
        ),
        sa.CheckConstraint(
            "history_factor BETWEEN 0 AND 3",
            name="fault_assessments_history_factor_check",
        ),
        sa.CheckConstraint(
            "length(btrim(priority_explanation)) > 0", name="ck_assessment_explanation"
        ),
        sa.CheckConstraint(
            "priority_score BETWEEN 2 AND 12",
            name="fault_assessments_priority_score_check",
        ),
        sa.CheckConstraint(
            "rule_priority_level IN ('low', 'medium', 'high', 'critical')",
            name="fault_assessments_rule_priority_level_check",
        ),
        sa.CheckConstraint(
            "severity_factor BETWEEN 1 AND 4",
            name="fault_assessments_severity_factor_check",
        ),
        sa.ForeignKeyConstraint(
            ["assessed_by", "assessed_by_role"],
            ["users.user_id", "users.role"],
            name="fk_assessment_engineer",
        ),
        sa.ForeignKeyConstraint(
            ["fault_id"], ["faults.fault_id"], name="fault_assessments_fault_id_fkey"
        ),
        sa.PrimaryKeyConstraint("assessment_id"),
    )
    op.create_index(
        "uq_assessment_current",
        "fault_assessments",
        ["fault_id"],
        unique=True,
        postgresql_where=sa.text("is_current"),
    )
    op.create_table(
        "fault_status_history",
        sa.Column(
            "history_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("fault_id", sa.UUID(), nullable=False),
        sa.Column("previous_status", sa.String(length=30), nullable=True),
        sa.Column("new_status", sa.String(length=30), nullable=False),
        sa.Column("changed_by", sa.UUID(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "new_status IN ('reported', 'assigned', 'under_inspection', 'awaiting_resources', 'under_repair', 'awaiting_verification', 'verified', 'closed', 'cancelled')",
            name="fault_status_history_new_status_check",
        ),
        sa.CheckConstraint(
            "previous_status IN ('reported', 'assigned', 'under_inspection', 'awaiting_resources', 'under_repair', 'awaiting_verification', 'verified', 'closed', 'cancelled')",
            name="fault_status_history_previous_status_check",
        ),
        sa.CheckConstraint(
            "previous_status IS DISTINCT FROM new_status", name="ck_history_changed"
        ),
        sa.ForeignKeyConstraint(
            ["changed_by"],
            ["users.user_id"],
            name="fault_status_history_changed_by_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["fault_id"], ["faults.fault_id"], name="fault_status_history_fault_id_fkey"
        ),
        sa.PrimaryKeyConstraint("history_id"),
    )
    op.create_table(
        "repair_verification_records",
        sa.Column(
            "record_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("fault_id", sa.UUID(), nullable=False),
        sa.Column("equipment_id", sa.UUID(), nullable=False),
        sa.Column("record_type", sa.String(length=30), nullable=False),
        sa.Column("performed_by", sa.UUID(), nullable=False),
        sa.Column(
            "performed_by_role",
            USER_ROLE,
            server_default=sa.text("'biomedical_engineer'"),
            nullable=False,
        ),
        sa.Column("work_performed", sa.Text(), nullable=True),
        sa.Column("parts_used", sa.Text(), nullable=True),
        sa.Column("repair_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("repair_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("test_result", sa.String(length=20), nullable=True),
        sa.Column("test_details", sa.Text(), nullable=True),
        sa.Column(
            "authorized_for_service",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "performed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "NOT authorized_for_service OR record_type = 'release'",
            name="ck_record_release_type",
        ),
        sa.CheckConstraint(
            "performed_by_role = 'biomedical_engineer'",
            name="repair_verification_records_performed_by_role_check",
        ),
        sa.CheckConstraint(
            "record_type <> 'repair' OR work_performed IS NOT NULL",
            name="ck_record_repair_work",
        ),
        sa.CheckConstraint(
            "record_type IN ('repair', 'functional_test', 'safety_test', 'calibration', 'performance_test', 'commissioning', 'release')",
            name="repair_verification_records_record_type_check",
        ),
        sa.CheckConstraint(
            "record_type NOT IN ('functional_test', 'safety_test', 'calibration', 'performance_test', 'commissioning') OR COALESCE(test_result IN ('pass', 'fail'), FALSE)",
            name="ck_record_test_result",
        ),
        sa.CheckConstraint(
            "test_result IN ('pass', 'fail', 'not_performed', 'not_applicable')",
            name="repair_verification_records_test_result_check",
        ),
        sa.CheckConstraint(
            "(released_at IS NOT NULL) = authorized_for_service",
            name="ck_record_release_pair",
        ),
        sa.CheckConstraint(
            "repair_completed_at IS NULL OR repair_started_at IS NULL OR repair_completed_at >= repair_started_at",
            name="ck_record_repair_dates",
        ),
        sa.ForeignKeyConstraint(
            ["fault_id", "equipment_id"],
            ["faults.fault_id", "faults.equipment_id"],
            name="fk_record_fault_equipment",
        ),
        sa.ForeignKeyConstraint(
            ["performed_by", "performed_by_role"],
            ["users.user_id", "users.role"],
            name="fk_record_engineer",
        ),
        sa.PrimaryKeyConstraint("record_id"),
    )
    op.create_index(
        "uq_record_one_release",
        "repair_verification_records",
        ["fault_id"],
        unique=True,
        postgresql_where=sa.text("authorized_for_service"),
    )
    op.create_table(
        "resource_requests",
        sa.Column(
            "request_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("requested_by", sa.UUID(), nullable=False),
        sa.Column("related_fault_id", sa.UUID(), nullable=True),
        sa.Column("request_type", sa.String(length=30), nullable=False),
        sa.Column("justification", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column("decision_by", sa.UUID(), nullable=True),
        sa.Column(
            "decision_by_role",
            USER_ROLE,
            server_default=sa.text("'health_manager'"),
            nullable=False,
        ),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(status = 'resolved') = (resolved_at IS NOT NULL)",
            name="ck_request_resolved",
        ),
        sa.CheckConstraint(
            "decision_by_role = 'health_manager'",
            name="resource_requests_decision_by_role_check",
        ),
        sa.CheckConstraint(
            "request_type IN ('spare_parts', 'technical_support', 'replacement_resource', 'new_equipment')",
            name="resource_requests_request_type_check",
        ),
        sa.CheckConstraint(
            "status = 'pending' OR (decision_by IS NOT NULL AND decided_at IS NOT NULL)",
            name="ck_request_decided",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'returned', 'in_progress', 'resolved')",
            name="resource_requests_status_check",
        ),
        sa.ForeignKeyConstraint(
            ["decision_by", "decision_by_role"],
            ["users.user_id", "users.role"],
            name="fk_request_decider",
        ),
        sa.ForeignKeyConstraint(
            ["related_fault_id"],
            ["faults.fault_id"],
            name="resource_requests_related_fault_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["requested_by"],
            ["users.user_id"],
            name="resource_requests_requested_by_fkey",
        ),
        sa.PrimaryKeyConstraint("request_id"),
    )
    op.create_table(
        "request_items",
        sa.Column(
            "item_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("request_id", sa.UUID(), nullable=False),
        sa.Column("item_name", sa.String(length=180), nullable=False),
        sa.Column("part_number", sa.String(length=80), nullable=True),
        sa.Column("specification", sa.Text(), nullable=True),
        sa.Column("unit", sa.String(length=30), nullable=True),
        sa.Column("quantity_requested", sa.Integer(), nullable=False),
        sa.Column("quantity_approved", sa.Integer(), nullable=True),
        sa.Column(
            "quantity_fulfilled",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "quantity_requested > 0", name="request_items_quantity_requested_check"
        ),
        sa.CheckConstraint(
            "quantity_approved >= 0 AND quantity_approved <= quantity_requested",
            name="request_items_quantity_approved_check",
        ),
        sa.CheckConstraint(
            "quantity_fulfilled >= 0", name="request_items_quantity_fulfilled_check"
        ),
        sa.CheckConstraint(
            "quantity_approved IS NULL OR quantity_fulfilled <= quantity_approved",
            name="ck_request_items_fulfilled_within_approved",
        ),
        sa.ForeignKeyConstraint(
            ["request_id"],
            ["resource_requests.request_id"],
            name="request_items_request_id_fkey",
        ),
        sa.PrimaryKeyConstraint("item_id"),
    )
    op.create_table(
        "request_follow_ups",
        sa.Column(
            "follow_up_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("request_id", sa.UUID(), nullable=False),
        sa.Column("organisation", sa.String(length=180), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=False),
        sa.Column("sent_at", sa.Date(), nullable=False),
        sa.Column("next_follow_up_date", sa.Date(), nullable=True),
        sa.Column(
            "reply_status",
            sa.String(length=20),
            server_default=sa.text("'no_reply'"),
            nullable=False,
        ),
        sa.Column("reply_at", sa.Date(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("logged_by", sa.UUID(), nullable=False),
        sa.Column(
            "logged_by_role",
            USER_ROLE,
            server_default=sa.text("'health_manager'"),
            nullable=False,
        ),
        sa.Column(
            "logged_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "channel IN ('letter', 'email', 'phone', 'in_person', 'other')",
            name="request_follow_ups_channel_check",
        ),
        sa.CheckConstraint(
            "reply_status IN ('no_reply', 'accepted', 'partly', 'declined')",
            name="request_follow_ups_reply_status_check",
        ),
        sa.CheckConstraint(
            "next_follow_up_date >= sent_at",
            name="request_follow_ups_next_follow_up_date_check",
        ),
        sa.CheckConstraint(
            "(reply_status = 'no_reply') = (reply_at IS NULL)",
            name="ck_follow_ups_reply_date",
        ),
        sa.CheckConstraint(
            "logged_by_role = 'health_manager'",
            name="request_follow_ups_logged_by_role_check",
        ),
        sa.ForeignKeyConstraint(
            ["logged_by", "logged_by_role"],
            ["users.user_id", "users.role"],
            name="fk_follow_up_manager",
        ),
        sa.ForeignKeyConstraint(
            ["request_id"],
            ["resource_requests.request_id"],
            name="request_follow_ups_request_id_fkey",
        ),
        sa.PrimaryKeyConstraint("follow_up_id"),
    )
    op.create_table(
        "notifications",
        sa.Column(
            "notification_id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("recipient_user_id", sa.UUID(), nullable=False),
        sa.Column("related_equipment_id", sa.UUID(), nullable=True),
        sa.Column("related_fault_id", sa.UUID(), nullable=True),
        sa.Column("related_request_id", sa.UUID(), nullable=True),
        sa.Column("notification_type", sa.String(length=60), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "channel",
            sa.String(length=20),
            server_default=sa.text("'in_app'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("channel IN ('in_app')", name="notifications_channel_check"),
        sa.CheckConstraint(
            "notification_type IN ('fault_reported', 'fault_assigned', 'fault_status_changed', 'registration_submitted', 'registration_decided', 'request_submitted', 'request_decided', 'request_follow_up_due', 'equipment_returned_to_service')",
            name="notifications_notification_type_check",
        ),
        sa.ForeignKeyConstraint(
            ["recipient_user_id"],
            ["users.user_id"],
            name="notifications_recipient_user_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["related_equipment_id"],
            ["equipment.equipment_id"],
            name="notifications_related_equipment_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["related_fault_id"],
            ["faults.fault_id"],
            name="notifications_related_fault_id_fkey",
        ),
        sa.ForeignKeyConstraint(
            ["related_request_id"],
            ["resource_requests.request_id"],
            name="notifications_related_request_id_fkey",
        ),
        sa.PrimaryKeyConstraint("notification_id"),
    )

    # 2. users <-> departments point at each other: add this foreign key last
    op.create_foreign_key(
        "fk_users_department",
        "users",
        "departments",
        ["department_id"],
        ["department_id"],
    )

    # 3. Triggers
    op.execute(
        "CREATE TRIGGER trg_equipment_updated_at BEFORE UPDATE ON equipment "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )
    op.execute(
        "CREATE TRIGGER trg_faults_updated_at BEFORE UPDATE ON faults "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )
    op.execute(CHECK_RELEASE_TESTS_SQL)
    op.execute(
        "CREATE TRIGGER trg_record_release_tests BEFORE INSERT OR UPDATE "
        "ON repair_verification_records FOR EACH ROW EXECUTE FUNCTION check_release_tests()"
    )

    # 4. Downtime view (read by dashboards and reports)
    op.execute(FAULT_DOWNTIME_VIEW_SQL)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS fault_downtime")
    op.drop_constraint("fk_users_department", "users", type_="foreignkey")
    op.drop_table("notifications")
    op.drop_table("request_follow_ups")
    op.drop_table("request_items")
    op.drop_table("resource_requests")
    op.drop_index(
        "uq_record_one_release",
        table_name="repair_verification_records",
        postgresql_where=sa.text("authorized_for_service"),
    )
    op.drop_table("repair_verification_records")
    op.drop_table("fault_status_history")
    op.drop_index(
        "uq_assessment_current",
        table_name="fault_assessments",
        postgresql_where=sa.text("is_current"),
    )
    op.drop_table("fault_assessments")
    op.drop_table("faults")
    op.drop_table("equipment_documents")
    op.drop_table("equipment")
    op.drop_table("departments")
    op.drop_table("audit_logs")
    op.drop_table("users")
    op.execute("DROP FUNCTION IF EXISTS check_release_tests()")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at()")
    op.execute("DROP TYPE IF EXISTS user_role")
