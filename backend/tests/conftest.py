import os
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import (
    CheckConstraint,
    ForeignKeyConstraint,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from database import Base
import models  # noqa: F401  (registers every model on Base.metadata)

NOW = datetime.now(timezone.utc)
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")


@pytest.fixture
def table():
    """table("users") -> the Table object from Base.metadata."""
    return lambda name: Base.metadata.tables[name]


@pytest.fixture
def checks():
    """checks("users") -> names of all CHECK constraints on that table."""
    return lambda name: {
        c.name
        for c in Base.metadata.tables[name].constraints
        if isinstance(c, CheckConstraint)
    }


@pytest.fixture
def uniques():
    """uniques("users") -> names of all UNIQUE constraints on that table."""
    return lambda name: {
        c.name
        for c in Base.metadata.tables[name].constraints
        if isinstance(c, UniqueConstraint)
    }


@pytest.fixture
def foreign_keys():
    def _fks(name):
        return {
            c.name: [e.target_fullname for e in c.elements]
            for c in Base.metadata.tables[name].constraints
            if isinstance(c, ForeignKeyConstraint)
        }

    return _fks


@pytest.fixture(scope="session")
def engine():
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL is not set")
    from alembic import command
    from alembic.config import Config

    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    cfg = Config("alembic.ini")
    command.upgrade(cfg, "head")
    eng = create_engine(TEST_DATABASE_URL)
    yield eng
    eng.dispose()
    command.downgrade(cfg, "base")


@pytest.fixture
def db(engine):
    conn = engine.connect()
    trans = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    trans.rollback()
    conn.close()


@pytest.fixture
def refused(db):
    def _refused(action):
        sp = db.begin_nested()
        try:
            action()
            db.flush()
        except (IntegrityError, DBAPIError):
            sp.rollback()
            return True
        sp.rollback()
        return False

    return _refused


@pytest.fixture
def data(db):
    from models import Department, Equipment, Fault, User, UserRole

    dept = Department(department_name="Maternity")
    db.add(dept)
    db.flush()
    accepted = dict(password_hash="argon2$hash", invitation_accepted_at=NOW)
    manager = User(
        full_name="Meron Alemu",
        email="meron@hospital.et",
        role=UserRole.HEALTH_MANAGER,
        **accepted,
    )
    engineer = User(
        full_name="Abebe Tadesse",
        email="abebe@hospital.et",
        role=UserRole.BIOMEDICAL_ENGINEER,
        department=dept,
        **accepted,
    )
    nurse = User(
        full_name="Tigist Bekele",
        email="tigist@hospital.et",
        role=UserRole.CLINICAL_STAFF,
        department=dept,
        **accepted,
    )
    db.add_all([manager, engineer, nurse])
    db.flush()
    machine = Equipment(
        manufacturer="Philips",
        model_name="Avalon FM20",
        equipment_category="fetal monitor",
        department=dept,
        asset_tag="WAL-000001",
        location="Labour room",
        acquisition_type="donated",
        registered_by=engineer.user_id,
        registration_status="approved",
        approved_by=manager.user_id,
        approved_at=NOW,
    )
    db.add(machine)
    db.flush()
    fault = Fault(
        equipment_id=machine.equipment_id,
        reported_by=nurse.user_id,
        description="No trace",
        severity="high",
        status="under_repair",
        assigned_engineer_id=engineer.user_id,
        out_of_service_at=NOW - timedelta(days=3),
    )
    db.add(fault)
    db.flush()
    return dict(
        dept=dept,
        manager=manager,
        engineer=engineer,
        nurse=nurse,
        machine=machine,
        fault=fault,
    )
