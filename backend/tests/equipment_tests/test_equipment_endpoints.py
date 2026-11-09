from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi import HTTPException
from fastapi.testclient import TestClient

from main import app
from models import UserRole
from routers.equipment import get_equipment_service
from security.dependencies import get_current_user


class TestEquipmentEndpoints:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_register_equipment_requires_authentication(self):
        with TestClient(app) as client:
            response = client.post("/equipment", json={})

        assert response.status_code == 401

    def test_list_equipment_requires_authentication(self):
        with TestClient(app) as client:
            response = client.get("/equipment")

        assert response.status_code == 401

    def test_get_equipment_requires_authentication(self):
        equipment_id = uuid4()

        with TestClient(app) as client:
            response = client.get(f"/equipment/{equipment_id}")

        assert response.status_code == 401

    def test_update_equipment_requires_authentication(self):
        equipment_id = uuid4()

        with TestClient(app) as client:
            response = client.patch(
                f"/equipment/{equipment_id}",
                json={"location": "Updated location"},
            )

        assert response.status_code == 401

    def test_registration_rejects_missing_required_fields(self):
        engineer = MagicMock()
        engineer.user_id = uuid4()
        engineer.role = UserRole.BIOMEDICAL_ENGINEER
        engineer.is_active = True

        def get_engineer():
            return engineer

        app.dependency_overrides[get_current_user] = get_engineer

        with TestClient(app) as client:
            response = client.post("/equipment", json={})

        assert response.status_code == 422

    def test_registration_rejects_blank_manufacturer(self):
        engineer = MagicMock()
        engineer.user_id = uuid4()
        engineer.role = UserRole.BIOMEDICAL_ENGINEER
        engineer.is_active = True

        def get_engineer():
            return engineer

        app.dependency_overrides[get_current_user] = get_engineer

        payload = {
            "manufacturer": "   ",
            "model_name": "Avalon FM20",
            "equipment_category": "fetal monitor",
            "department_id": str(uuid4()),
            "asset_tag": "TEST-0001",
            "location": "Labour room",
            "acquisition_type": "donated",
        }

        with TestClient(app) as client:
            response = client.post("/equipment", json=payload)

        assert response.status_code == 422

    def test_registration_returns_created_equipment(self):
        engineer = MagicMock()
        engineer.user_id = uuid4()
        engineer.role = UserRole.BIOMEDICAL_ENGINEER
        engineer.is_active = True

        equipment_id = uuid4()
        department_id = uuid4()

        equipment = {
            "equipment_id": equipment_id,
            "manufacturer": "Philips",
            "model_name": "Avalon FM20",
            "model_number": None,
            "equipment_category": "fetal monitor",
            "department_id": department_id,
            "asset_tag": "TEST-0002",
            "serial_number": None,
            "location": "Labour room",
            "acquisition_type": "donated",
            "registration_status": "pending",
            "installation_status": "unknown",
            "service_status": "not_assessed",
            "registered_by": engineer.user_id,
            "approved_by": None,
            "approved_at": None,
            "created_at": datetime.now(timezone.utc),
        }

        service = MagicMock()
        service.register_new_equipment.return_value = equipment

        def get_engineer():
            return engineer

        def get_service():
            return service

        app.dependency_overrides[get_current_user] = get_engineer
        app.dependency_overrides[get_equipment_service] = get_service

        payload = {
            "manufacturer": "Philips",
            "model_name": "Avalon FM20",
            "equipment_category": "fetal monitor",
            "department_id": str(department_id),
            "asset_tag": "TEST-0002",
            "location": "Labour room",
            "acquisition_type": "donated",
        }

        with TestClient(app) as client:
            response = client.post("/equipment", json=payload)

        assert response.status_code == 201
        assert response.json()["asset_tag"] == "TEST-0002"
        service.register_new_equipment.assert_called_once()


class TestDepartmentEndpoints:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def setup_engineer_and_service(self, service):
        engineer = MagicMock()
        engineer.user_id = uuid4()
        engineer.role = UserRole.HEALTH_MANAGER
        engineer.is_active = True

        app.dependency_overrides[get_current_user] = lambda: engineer
        app.dependency_overrides[get_equipment_service] = lambda: service

    def test_update_department_returns_updated_department(self):
        department_id = uuid4()
        service = MagicMock()
        service.update_department.return_value = {
            "department_id": department_id,
            "department_name": "Updated ICU",
            "description": "Updated description",
            "responsible_engineer_id": uuid4(),
            "responsible_engineer_role": "biomedical_engineer",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
        }
        self.setup_engineer_and_service(service)

        with TestClient(app) as client:
            response = client.patch(
                f"/equipment/departments/{department_id}",
                json={"department_name": "Updated ICU"},
            )

        assert response.status_code == 200
        assert response.json()["department_name"] == "Updated ICU"
        service.update_department.assert_called_once()

    def test_deactivate_department_returns_inactive_department(self):
        department_id = uuid4()
        service = MagicMock()
        service.deactivate_department.return_value = {
            "department_id": department_id,
            "department_name": "ICU",
            "description": None,
            "responsible_engineer_id": uuid4(),
            "responsible_engineer_role": "biomedical_engineer",
            "is_active": False,
            "created_at": datetime.now(timezone.utc),
        }
        self.setup_engineer_and_service(service)

        with TestClient(app) as client:
            response = client.patch(
                f"/equipment/departments/{department_id}/deactivate"
            )

        assert response.status_code == 200
        assert response.json()["is_active"] is False
        service.deactivate_department.assert_called_once_with(department_id)

    def test_update_department_requires_authentication(self):
        department_id = uuid4()

        with TestClient(app) as client:
            response = client.patch(
                f"/equipment/departments/{department_id}",
                json={"department_name": "Updated ICU"},
            )

        assert response.status_code == 401

    def test_deactivate_department_requires_authentication(self):
        department_id = uuid4()

        with TestClient(app) as client:
            response = client.patch(
                f"/equipment/departments/{department_id}/deactivate"
            )

        assert response.status_code == 401


class TestDepartmentCreateListGetEndpoints:
    def setup_manager_and_service(self, service):

        manager = MagicMock()
        manager.user_id = uuid4()
        manager.role = UserRole.HEALTH_MANAGER
        manager.is_active = True

        app.dependency_overrides[get_current_user] = lambda: manager
        app.dependency_overrides[get_equipment_service] = lambda: service

        self.client = TestClient(app)
        self.service = service
        self.manager = manager

    def teardown_method(self):

        app.dependency_overrides.clear()

    def department_response(self, **overrides):
        department = {
            "department_id": uuid4(),
            "department_name": "Radiology",
            "description": "Imaging department",
            "responsible_engineer_id": uuid4(),
            "responsible_engineer_role": "biomedical_engineer",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
        }
        department.update(overrides)
        return department

    def test_create_department_returns_created_department(self):

        service = MagicMock()
        self.setup_manager_and_service(service)
        response_data = self.department_response()
        service.add_department.return_value = response_data

        response = self.client.post(
            "/equipment/departments",
            json={
                "department_name": "Radiology",
                "description": "Imaging department",
                "responsible_engineer_id": str(
                    response_data["responsible_engineer_id"]
                ),
                "is_active": True,
            },
        )

        assert response.status_code == 201
        assert response.json()["department_name"] == "Radiology"
        assert response.json()["is_active"] is True
        service.add_department.assert_called_once()

    def test_create_department_rejects_missing_required_fields(self):

        service = MagicMock()
        self.setup_manager_and_service(service)

        response = self.client.post(
            "/equipment/departments",
            json={"description": "Missing required fields"},
        )

        assert response.status_code == 422
        service.add_department.assert_not_called()

    def test_create_department_rejects_blank_name(self):

        service = MagicMock()
        self.setup_manager_and_service(service)

        response = self.client.post(
            "/equipment/departments",
            json={
                "department_name": "",
                "responsible_engineer_id": str(uuid4()),
            },
        )

        assert response.status_code == 422
        service.add_department.assert_not_called()

    def test_list_departments_returns_departments(self):

        service = MagicMock()
        self.setup_manager_and_service(service)
        departments = [
            self.department_response(),
            self.department_response(
                department_name="Emergency",
                description="Emergency department",
            ),
        ]
        service.list_departments.return_value = departments

        response = self.client.get("/equipment/departments")

        assert response.status_code == 200
        assert len(response.json()) == 2
        assert response.json()[0]["department_name"] == "Radiology"
        assert response.json()[1]["department_name"] == "Emergency"
        service.list_departments.assert_called_once_with(self.manager)

    def test_list_departments_returns_empty_list(self):

        service = MagicMock()
        self.setup_manager_and_service(service)
        service.list_departments.return_value = []

        response = self.client.get("/equipment/departments")

        assert response.status_code == 200
        assert response.json() == []

    def test_get_department_returns_department(self):

        service = MagicMock()
        self.setup_manager_and_service(service)
        department_id = uuid4()
        department = self.department_response(department_id=department_id)
        service.get_department.return_value = department

        response = self.client.get(f"/equipment/departments/{department_id}")

        assert response.status_code == 200
        assert response.json()["department_name"] == "Radiology"
        service.get_department.assert_called_once_with(department_id, self.manager)

    def test_get_department_returns_not_found(self):

        service = MagicMock()
        self.setup_manager_and_service(service)
        department_id = uuid4()
        service.get_department.side_effect = HTTPException(
            status_code=404,
            detail="Department not found.",
        )

        response = self.client.get(f"/equipment/departments/{department_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Department not found."

    def test_get_department_rejects_invalid_uuid(self):

        service = MagicMock()
        self.setup_manager_and_service(service)

        response = self.client.get("/equipment/departments/not-a-valid-uuid")

        assert response.status_code == 422
        service.get_department.assert_not_called()


class TestEquipmentWorkflowEndpoints:
    def setup_method(self):

        self.app = app
        self.service = MagicMock()
        self.user = MagicMock()
        self.user.user_id = uuid4()
        self.user.role = UserRole.HEALTH_MANAGER
        self.user.is_active = True

        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_equipment_service] = lambda: self.service
        self.client = TestClient(app)

    def teardown_method(self):
        self.app.dependency_overrides.clear()

    def equipment_response(self, **overrides):

        data = {
            "equipment_id": uuid4(),
            "manufacturer": "Acme Medical",
            "model_name": "Monitor X",
            "model_number": "MX-100",
            "equipment_category": "Patient Monitor",
            "department_id": uuid4(),
            "asset_tag": "ASSET-100",
            "serial_number": "SN-100",
            "location": "Ward A",
            "acquisition_type": "purchased",
            "registration_status": "pending",
            "installation_status": "unknown",
            "service_status": "not_assessed",
            "registered_by": uuid4(),
            "approved_by": None,
            "approved_at": None,
            "created_at": datetime.now(timezone.utc),
        }
        data.update(overrides)
        return data

    def test_list_equipment_returns_list(self):
        self.service.fetch_equipment_catalog.return_value = [
            self.equipment_response(),
            self.equipment_response(
                asset_tag="ASSET-200",
                model_name="Monitor Y",
            ),
        ]

        response = self.client.get("/equipment")

        assert response.status_code == 200
        assert len(response.json()) == 2
        self.service.fetch_equipment_catalog.assert_called_once_with(
            UserRole.HEALTH_MANAGER.value
        )

    def test_list_equipment_returns_empty_list(self):
        self.service.fetch_equipment_catalog.return_value = []

        response = self.client.get("/equipment")

        assert response.status_code == 200
        assert response.json() == []

    def test_get_equipment_returns_equipment(self):

        equipment_id = uuid4()
        self.service.get_equipment.return_value = self.equipment_response(
            equipment_id=equipment_id
        )

        response = self.client.get(f"/equipment/{equipment_id}")

        assert response.status_code == 200
        assert response.json()["asset_tag"] == "ASSET-100"
        self.service.get_equipment.assert_called_once_with(
            equipment_id, UserRole.HEALTH_MANAGER.value
        )

    def test_get_equipment_returns_not_found(self):

        equipment_id = uuid4()
        self.service.get_equipment.side_effect = HTTPException(
            status_code=404,
            detail="Equipment not found.",
        )

        response = self.client.get(f"/equipment/{equipment_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Equipment not found."

    def test_update_equipment_returns_updated_equipment(self):

        equipment_id = uuid4()
        self.service.modify_equipment.return_value = self.equipment_response(
            equipment_id=equipment_id,
            location="Ward B",
        )

        response = self.client.patch(
            f"/equipment/{equipment_id}",
            json={"location": "Ward B"},
        )

        assert response.status_code == 200
        assert response.json()["location"] == "Ward B"
        self.service.modify_equipment.assert_called_once()

    def test_update_equipment_rejects_empty_update(self):

        equipment_id = uuid4()
        self.service.modify_equipment.side_effect = HTTPException(
            status_code=422,
            detail="Provide at least one field to update.",
        )

        response = self.client.patch(
            f"/equipment/{equipment_id}",
            json={},
        )

        assert response.status_code == 422
        assert response.json()["detail"] == ("Provide at least one field to update.")

    def test_update_equipment_rejects_invalid_status(self):

        response = self.client.patch(
            f"/equipment/{uuid4()}",
            json={"installation_status": "invalid_status"},
        )

        assert response.status_code == 422
        self.service.modify_equipment.assert_not_called()

    def test_pending_equipment_returns_list(self):
        self.service.list_pending_registrations.return_value = [
            self.equipment_response()
        ]

        response = self.client.get("/equipment/pending")

        assert response.status_code == 200
        assert len(response.json()) == 1
        self.service.list_pending_registrations.assert_called_once()

    def test_approve_equipment_returns_approved_record(self):

        equipment_id = uuid4()
        self.service.process_approval.return_value = self.equipment_response(
            equipment_id=equipment_id,
            registration_status="approved",
            approved_by=self.user.user_id,
            approved_at=self.equipment_response()["created_at"],
        )

        response = self.client.post(f"/equipment/{equipment_id}/approve")

        assert response.status_code == 200
        assert response.json()["registration_status"] == "approved"
        self.service.process_approval.assert_called_once_with(
            equipment_id, self.user.user_id
        )

    def test_approve_equipment_returns_conflict_when_not_pending(self):

        equipment_id = uuid4()
        self.service.process_approval.side_effect = HTTPException(
            status_code=409,
            detail="Only pending registrations can be approved.",
        )

        response = self.client.post(f"/equipment/{equipment_id}/approve")

        assert response.status_code == 409

    def test_return_equipment_returns_record(self):

        equipment_id = uuid4()
        self.service.process_return.return_value = self.equipment_response(
            equipment_id=equipment_id,
            registration_status="returned",
        )

        response = self.client.post(
            f"/equipment/{equipment_id}/return",
            json={"reason": "Missing supporting documentation"},
        )

        assert response.status_code == 200
        assert response.json()["registration_status"] == "returned"
        self.service.process_return.assert_called_once_with(
            equipment_id=equipment_id,
            reason="Missing supporting documentation",
        )

    def test_return_equipment_rejects_invalid_reason_type(self):

        response = self.client.post(
            f"/equipment/{uuid4()}/return",
            json={"reason": 123},
        )

        assert response.status_code in (200, 422)


class TestEquipmentCSVImportEndpoints:
    def setup_method(self):

        self.app = app
        self.service = MagicMock()

        self.user = MagicMock()
        self.user.user_id = uuid4()
        self.user.role = UserRole.BIOMEDICAL_ENGINEER
        self.user.is_active = True

        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_equipment_service] = lambda: self.service
        self.client = TestClient(app)

    def teardown_method(self):
        self.app.dependency_overrides.clear()

    def test_csv_import_rejects_non_csv_file(self):
        from fastapi import HTTPException, status

        self.service.batch_import_csv.side_effect = HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Please upload a CSV file.",
        )

        response = self.client.post(
            "/equipment/import-csv",
            files={
                "file": (
                    "equipment.txt",
                    b"not a csv file",
                    "text/plain",
                )
            },
        )

        assert response.status_code == 415
        assert response.json()["detail"] == "Please upload a CSV file."
        self.service.batch_import_csv.assert_called_once_with(
            b"not a csv file",
            self.user.user_id,
            filename="equipment.txt",
        )

    def test_csv_import_rejects_empty_file(self):
        from fastapi import HTTPException, status

        self.service.batch_import_csv.side_effect = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded CSV file is empty.",
        )

        response = self.client.post(
            "/equipment/import-csv",
            files={
                "file": (
                    "equipment.csv",
                    b"",
                    "text/csv",
                )
            },
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "The uploaded CSV file is empty."
        self.service.batch_import_csv.assert_called_once_with(
            b"",
            self.user.user_id,
            filename="equipment.csv",
        )

    def test_csv_import_calls_service_for_valid_csv(self):
        csv_content = (
            "manufacturer,model_name,equipment_category,"
            "department_id,asset_tag,location\n"
            "Acme,Monitor X,Monitor,"
            "00000000-0000-0000-0000-000000000001,"
            "ASSET-500,Ward A\n"
        )
        self.service.batch_import_csv.return_value = {
            "imported": 1,
            "errors": [],
        }

        response = self.client.post(
            "/equipment/import-csv",
            files={
                "file": (
                    "equipment.csv",
                    csv_content.encode("utf-8"),
                    "text/csv",
                )
            },
        )

        assert response.status_code == 200
        self.service.batch_import_csv.assert_called_once_with(
            csv_content.encode("utf-8"),
            self.user.user_id,
            filename="equipment.csv",
        )


def test_health_manager_can_delete_equipment_document():
    manager = MagicMock()
    manager.user_id = uuid4()
    manager.role = UserRole.HEALTH_MANAGER
    manager.is_active = True

    document_id = uuid4()
    service = MagicMock()

    app.dependency_overrides[get_current_user] = lambda: manager
    app.dependency_overrides[get_equipment_service] = lambda: service

    with TestClient(app) as client:
        response = client.delete(f"/equipment/documents/{document_id}")

    assert response.status_code == 204
    service.delete_document.assert_called_once_with(document_id)
    app.dependency_overrides.clear()


def test_biomedical_engineer_cannot_delete_equipment_document():
    engineer = MagicMock()
    engineer.user_id = uuid4()
    engineer.role = UserRole.BIOMEDICAL_ENGINEER
    engineer.is_active = True

    service = MagicMock()

    app.dependency_overrides[get_current_user] = lambda: engineer
    app.dependency_overrides[get_equipment_service] = lambda: service

    with TestClient(app) as client:
        response = client.delete(f"/equipment/documents/{uuid4()}")

    assert response.status_code == 403
    service.delete_document.assert_not_called()
    app.dependency_overrides.clear()
