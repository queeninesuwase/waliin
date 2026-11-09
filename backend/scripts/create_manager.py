import getpass
import sys
from datetime import datetime, timezone

from database import SessionLocal
from models import User, UserRole
from repositories import user_repository
from security.passwords import PasswordPolicyError, check_password_policy, hash_password
from services.auth_service import normalize_email


def create_manager(db, full_name, email, password):
    """Create the health manager. Raises ValueError or PasswordPolicyError if something is wrong."""
    email = normalize_email(email)
    full_name = full_name.strip()
    if not full_name:
        raise ValueError("Full name is required.")
    if user_repository.manager_exists(db):
        raise ValueError("A health manager already exists.")
    if user_repository.get_user_by_email(db, email) is not None:
        raise ValueError("This email is already used.")
    check_password_policy(password, email=email)

    manager = User(
        full_name=full_name,
        email=email,
        role=UserRole.HEALTH_MANAGER,
        password_hash=hash_password(password),
        # No invitation for the manager: the account is ready to use at once.
        invitation_accepted_at=datetime.now(timezone.utc),
    )
    user_repository.add_user(db, manager)
    db.commit()
    return manager


def main():
    full_name = input("Full name: ")
    email = input("Email: ")
    password = getpass.getpass("Password (at least 12 characters): ")
    if password != getpass.getpass("Confirm password: "):
        print("Passwords do not match.")
        return 1

    db = SessionLocal()
    try:
        create_manager(db, full_name, email, password)
    except (ValueError, PasswordPolicyError) as error:
        print(error)
        return 1
    finally:
        db.close()
    print("Health manager created.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
