from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

from main import app
from models import UserRole
from security.dependencies import get_current_user


class TestEquipmentAuthorization:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_register_equipment_requires_authentication(self):
        with TestClient(app) as client:
            response = client.post("/equipment", json={})

        assert response.status_code == 401

    def test_create_department_requires_authentication(self):
        with TestClient(app) as client:
            response = client.post(
                "/equipment/departments",
                json={},
            )

        assert response.status_code == 401

    def test_list_pending_equipment_requires_authentication(self):
        with TestClient(app) as client:
            response = client.get("/equipment/pending")

        assert response.status_code == 401

    def test_approve_equipment_requires_authentication(self):
        equipment_id = "00000000-0000-0000-0000-000000000001"

        with TestClient(app) as client:
            response = client.post(
                f"/equipment/{equipment_id}/approve",
            )

        assert response.status_code == 401


class TestEquipmentRoleAuthorization:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def make_user(self, role):
        user = MagicMock()
        user.user_id = uuid4()
        user.role = role
        user.is_active = True
        return user

    def test_nurse_cannot_register_equipment(self):
        nurse = self.make_user(UserRole.CLINICAL_STAFF)

        def get_nurse():
            return nurse

        app.dependency_overrides[get_current_user] = get_nurse

        with TestClient(app) as client:
            response = client.post("/equipment", json={})

        assert response.status_code == 403

    def test_engineer_cannot_approve_equipment(self):
        engineer = self.make_user(UserRole.BIOMEDICAL_ENGINEER)

        def get_engineer():
            return engineer

        app.dependency_overrides[get_current_user] = get_engineer

        with TestClient(app) as client:
            response = client.post(f"/equipment/{uuid4()}/approve")

        assert response.status_code == 403
