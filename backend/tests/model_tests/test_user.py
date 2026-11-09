from datetime import datetime, timedelta, timezone

from models import User, UserRole

NOW = datetime.now(timezone.utc)


def test_users_has_all_columns(table):
    assert set(table("users").c.keys()) == {
        "user_id",
        "full_name",
        "email",
        "password_hash",
        "role",
        "department_id",
        "is_active",
        "invited_by",
        "invitation_token_hash",
        "invitation_expires_at",
        "invitation_accepted_at",
        "reset_token_hash",
        "reset_token_expires_at",
        "mfa_enabled",
        "mfa_secret_encrypted",
        "token_version",
        "created_at",
    }


def test_name_and_password_are_empty_until_invitation_accepted(table):
    assert table("users").c.full_name.nullable
    assert table("users").c.password_hash.nullable


def test_users_constraints(checks, uniques):
    assert {
        "users_email_check",
        "ck_users_password_after_accept",
        "ck_users_name_after_accept",
        "ck_users_department_required",
        "ck_users_mfa_secret",
        "ck_users_reset_pair",
        "users_token_version_check",
    } <= checks("users")
    assert {"users_email_key", "uq_users_id_role"} <= uniques("users")


def test_user_roles():
    assert [r.value for r in UserRole] == [
        "clinical_staff",
        "biomedical_engineer",
        "health_manager",
    ]


def test_invited_user_has_no_name_or_password(db, data):
    invited = User(
        email="hana@hospital.et",
        role=UserRole.CLINICAL_STAFF,
        department=data["dept"],
        invited_by=data["manager"].user_id,
        invitation_token_hash="hash",
        invitation_expires_at=NOW + timedelta(hours=48),
    )
    db.add(invited)
    db.flush()
    assert invited.full_name is None and invited.password_hash is None
    assert invited.invited_by_user.email == "meron@hospital.et"


def test_accepting_without_a_name_is_refused(db, data, refused):
    u = User(
        email="sara@hospital.et", role=UserRole.CLINICAL_STAFF, department=data["dept"]
    )
    db.add(u)
    db.flush()
    assert refused(
        lambda: (
            setattr(u, "password_hash", "h"),
            setattr(u, "invitation_accepted_at", NOW),
        )
    )


def test_clinical_staff_needs_a_department(db, refused):
    assert refused(
        lambda: db.add(User(email="x@hospital.et", role=UserRole.CLINICAL_STAFF))
    )


def test_duplicate_email_is_refused(db, data, refused):
    assert refused(
        lambda: db.add(User(email="meron@hospital.et", role=UserRole.HEALTH_MANAGER))
    )


def test_email_must_be_lower_case(db, refused):
    assert refused(
        lambda: db.add(User(email="Meron@Hospital.et", role=UserRole.HEALTH_MANAGER))
    )


def test_mfa_on_needs_a_secret(db, data, refused):
    assert refused(lambda: setattr(data["manager"], "mfa_enabled", True))


def test_reset_token_needs_an_expiry(db, data, refused):
    assert refused(lambda: setattr(data["engineer"], "reset_token_hash", "hash"))


def test_new_user_defaults(db, data):
    u = User(
        email="new@hospital.et", role=UserRole.CLINICAL_STAFF, department=data["dept"]
    )
    db.add(u)
    db.flush()
    db.refresh(u)
    assert u.is_active is True and u.mfa_enabled is False and u.token_version == 0
