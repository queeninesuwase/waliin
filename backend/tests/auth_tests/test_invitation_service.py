"""Tests for services/invitation_service.py: invite, resend and accept."""

import re
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from models import AuditLog, UserRole
from security.tokens import hash_token
from security.passwords import verify_password
from services import invitation_service
from services.invitation_service import InvalidInvitationError
from services.user_service import (
    AccountRevokedError,
    DuplicateEmailError,
    InvitationAlreadyAcceptedError,
    UnknownDepartmentError,
)

NOW = datetime.now(timezone.utc)
PASSWORD = "labour ward night shift"


def token_from(email_message):
    return re.search(
        r"token=([\w-]+)",
        email_message.get_body(preferencelist=("plain",)).get_content(),
    ).group(1)


def invite(db, data, email="selam@hospital.et", role="clinical_staff"):
    return invitation_service.invite_user(
        db, data["manager"], email, role, data["dept"].department_id, now=NOW
    )


# ---------------------------------------------------------------- invite
def test_invite_saves_only_the_token_hash_and_emails_the_link(db, data, emails):
    user = invite(db, data)
    raw_token = token_from(emails[0])
    assert user.invitation_token_hash == hash_token(raw_token)
    assert raw_token not in user.invitation_token_hash
    assert emails[0]["To"] == "selam@hospital.et"


def test_invite_lasts_72_hours(db, data):
    user = invite(db, data)
    assert user.invitation_expires_at == NOW + timedelta(hours=72)


def test_invited_user_has_no_name_or_password_yet(db, data):
    user = invite(db, data)
    assert user.full_name is None and user.password_hash is None
    assert user.invited_by == data["manager"].user_id


def test_invite_email_is_stored_lower_case(db, data):
    assert invite(db, data, email="  Selam@Hospital.ET ").email == "selam@hospital.et"


def test_invite_is_audited(db, data):
    user = invite(db, data)
    row = db.scalars(select(AuditLog).where(AuditLog.action == "user_invited")).one()
    assert (
        row.entity_id == user.user_id and row.actor_user_id == data["manager"].user_id
    )


def test_duplicate_email_is_refused(db, data):
    with pytest.raises(DuplicateEmailError):
        invite(db, data, email="tigist@hospital.et")


def test_manager_role_cannot_be_invited(db, data):
    with pytest.raises(ValueError):
        invite(db, data, role="health_manager")


def test_unknown_department_is_refused(db, data):
    import uuid

    with pytest.raises(UnknownDepartmentError):
        invitation_service.invite_user(
            db, data["manager"], "selam@hospital.et", "clinical_staff", uuid.uuid4()
        )


# ---------------------------------------------------------------- resend
def test_resend_replaces_the_old_link(db, data, emails):
    user = invite(db, data)
    old_token = token_from(emails[0])
    invitation_service.resend_invitation(db, data["manager"], user, now=NOW)
    new_token = token_from(emails[1])
    assert new_token != old_token
    assert user.invitation_token_hash == hash_token(new_token)


def test_resend_after_acceptance_is_refused(db, data, emails):
    user = invite(db, data)
    invitation_service.accept_invitation(
        db, token_from(emails[0]), "Selam Tesfaye", PASSWORD, PASSWORD
    )
    with pytest.raises(InvitationAlreadyAcceptedError):
        invitation_service.resend_invitation(db, data["manager"], user)


def test_resend_for_revoked_user_is_refused(db, data):
    user = invite(db, data)
    user.is_active = False
    db.flush()
    with pytest.raises(AccountRevokedError):
        invitation_service.resend_invitation(db, data["manager"], user)


# ---------------------------------------------------------------- accept
def test_accept_sets_name_and_password(db, data, emails):
    invite(db, data)
    user = invitation_service.accept_invitation(
        db, token_from(emails[0]), "  Selam Tesfaye ", PASSWORD, PASSWORD
    )
    assert user.full_name == "Selam Tesfaye"
    assert verify_password(user.password_hash, PASSWORD)
    assert user.invitation_accepted_at is not None
    assert UserRole(user.role) == UserRole.CLINICAL_STAFF


def test_link_works_only_once(db, data, emails):
    invite(db, data)
    raw_token = token_from(emails[0])
    invitation_service.accept_invitation(
        db, raw_token, "Selam Tesfaye", PASSWORD, PASSWORD
    )
    with pytest.raises(InvalidInvitationError):
        invitation_service.accept_invitation(
            db, raw_token, "Someone Else", PASSWORD, PASSWORD
        )


def test_expired_link_is_refused(db, data, emails):
    invite(db, data)
    later = NOW + timedelta(hours=72)
    with pytest.raises(InvalidInvitationError):
        invitation_service.accept_invitation(
            db, token_from(emails[0]), "Selam Tesfaye", PASSWORD, PASSWORD, now=later
        )


def test_old_link_stops_working_after_resend(db, data, emails):
    user = invite(db, data)
    old_token = token_from(emails[0])
    invitation_service.resend_invitation(db, data["manager"], user)
    with pytest.raises(InvalidInvitationError):
        invitation_service.accept_invitation(
            db, old_token, "Selam Tesfaye", PASSWORD, PASSWORD
        )


def test_made_up_link_is_refused(db, data):
    with pytest.raises(InvalidInvitationError):
        invitation_service.accept_invitation(
            db, "made-up-token-that-is-long", "Selam Tesfaye", PASSWORD, PASSWORD
        )


def test_passwords_must_match(db, data, emails):
    invite(db, data)
    with pytest.raises(ValueError, match="do not match"):
        invitation_service.accept_invitation(
            db, token_from(emails[0]), "Selam Tesfaye", PASSWORD, PASSWORD + "x"
        )


def test_weak_password_is_refused(db, data, emails):
    invite(db, data)
    with pytest.raises(ValueError):
        invitation_service.accept_invitation(
            db, token_from(emails[0]), "Selam Tesfaye", "short", "short"
        )


def test_empty_name_is_refused(db, data, emails):
    invite(db, data)
    with pytest.raises(ValueError, match="Full name"):
        invitation_service.accept_invitation(
            db, token_from(emails[0]), "   ", PASSWORD, PASSWORD
        )
