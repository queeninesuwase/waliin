from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from database import get_db
from models import User, UserRole
from routers.auth import router as auth_router
from tests.auth_tests.conftest import mark_session_mfa_verified
from security.dependencies import require_role

PASSWORD = "maternity ward monitor"  # same as in conftest.py

roles_app = FastAPI()
ManagerUser = Annotated[User, Depends(require_role(UserRole.HEALTH_MANAGER))]
StaffUser = Annotated[
    User, Depends(require_role(UserRole.CLINICAL_STAFF, UserRole.BIOMEDICAL_ENGINEER))
]
roles_app.include_router(auth_router)


@roles_app.get("/manager-only")
def manager_only(user: ManagerUser):
    return {"ok": True}


@roles_app.get("/staff-only")
def staff_only(user: StaffUser):
    return {"ok": True}


@pytest.fixture
def role_client(db):
    roles_app.dependency_overrides[get_db] = lambda: db
    with TestClient(roles_app, base_url="https://testserver") as test_client:
        yield test_client
    roles_app.dependency_overrides.clear()


def sign_in(client, email):
    response = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200
    if email in {"meron@hospital.et", "abebe@hospital.et"}:
        mark_session_mfa_verified(client)


def test_not_signed_in_gets_401(role_client, accounts):
    assert role_client.get("/manager-only").status_code == 401


def test_manager_reaches_manager_endpoint(role_client, accounts):
    sign_in(role_client, "meron@hospital.et")
    assert role_client.get("/manager-only").status_code == 200


def test_nurse_gets_403_on_manager_endpoint(role_client, accounts):
    sign_in(role_client, "tigist@hospital.et")
    assert role_client.get("/manager-only").status_code == 403


def test_engineer_reaches_staff_endpoint(role_client, accounts):
    sign_in(role_client, "abebe@hospital.et")
    assert role_client.get("/staff-only").status_code == 200


def test_manager_gets_403_on_staff_endpoint(role_client, accounts):
    sign_in(role_client, "meron@hospital.et")
    assert role_client.get("/staff-only").status_code == 403


def test_revoked_user_is_signed_out_at_once(role_client, db, accounts):
    sign_in(role_client, "abebe@hospital.et")
    accounts["engineer"].is_active = False
    db.flush()
    assert role_client.get("/staff-only").status_code == 401
