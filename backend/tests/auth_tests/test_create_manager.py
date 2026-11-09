import pytest

from models import UserRole
from scripts.create_manager import create_manager
from security.passwords import PasswordPolicyError, verify_password

PASSWORD = "maternity ward monitor"


def test_creates_the_health_manager(db):
    manager = create_manager(db, " Meron Alemu ", " Meron@Hospital.ET ", PASSWORD)
    assert UserRole(manager.role) == UserRole.HEALTH_MANAGER
    assert manager.full_name == "Meron Alemu"
    assert manager.email == "meron@hospital.et"
    assert manager.department_id is None
    assert manager.invitation_accepted_at is not None
    assert verify_password(manager.password_hash, PASSWORD)


def test_only_one_manager_is_allowed(db):
    create_manager(db, "Meron Alemu", "meron@hospital.et", PASSWORD)
    with pytest.raises(ValueError, match="already exists"):
        create_manager(db, "Second Manager", "second@hospital.et", PASSWORD)


def test_weak_password_is_refused(db):
    with pytest.raises(PasswordPolicyError):
        create_manager(db, "Meron Alemu", "meron@hospital.et", "short")


def test_empty_name_is_refused(db):
    with pytest.raises(ValueError, match="Full name"):
        create_manager(db, "   ", "meron@hospital.et", PASSWORD)
