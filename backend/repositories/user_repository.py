"""Database queries for the users table. No business rules here."""

from sqlalchemy import select

from models import Department, User, UserRole


def get_user_by_email(db, email):
    return db.scalars(select(User).where(User.email == email)).first()


def manager_exists(db):
    query = select(User.user_id).where(User.role == UserRole.HEALTH_MANAGER)
    return db.scalars(query).first() is not None


def add_user(db, user):
    db.add(user)
    db.flush()
    return user


def get_user_by_id(db, user_id):
    return db.get(User, user_id)


def get_user_by_invitation_hash(db, token_hash):
    query = select(User).where(User.invitation_token_hash == token_hash)
    return db.scalars(query).first()


def list_users(db, role=None, department_id=None):
    query = select(User).order_by(User.created_at)
    if role is not None:
        query = query.where(User.role == role)
    if department_id is not None:
        query = query.where(User.department_id == department_id)
    return db.scalars(query).all()


def get_user_by_reset_hash(db, token_hash):
    query = select(User).where(User.reset_token_hash == token_hash)
    return db.scalars(query).first()


def save_user(db, user):
    """Send pending changes on an existing user to the database (no commit)."""
    db.flush()
    return user


def add_audit_entry(db, entry):
    """Add one audit row. The service commits it with the change it describes."""
    db.add(entry)
    db.flush()
    return entry


def commit(db):
    db.commit()


def rollback(db):
    db.rollback()


def refresh_user(db, user):
    db.refresh(user)


def get_active_department(db, department_id):
    department = db.get(Department, department_id)
    if department is None or not department.is_active:
        return None
    return department


def get_user_by_id_for_update(db, user_id):
    """Load and lock a user row for a security-sensitive update."""
    query = (
        select(User)
        .where(User.user_id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return db.scalars(query).first()
