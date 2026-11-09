import io
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException, UploadFile

from schemas.equipment import EquipmentCreate
from services.equipment import EquipmentService


@pytest.fixture
def repo():
    return MagicMock()


@pytest.fixture
def service(repo):
    return EquipmentService(repo)


@pytest.fixture
def equipment_data(repo):
    department_id = uuid4()
    repo.get_department_by_id.return_value = SimpleNamespace(
        department_id=department_id,
        is_active=True,
    )
    repo.get_by_asset_tag.return_value = None

    return EquipmentCreate(
        manufacturer="Acme Medical",
        model_name="Monitor X",
        equipment_category="Patient Monitor",
        department_id=department_id,
        asset_tag="ASSET-100",
        location="Ward A",
    )


def test_register_equipment_success(service, repo, equipment_data):
    user_id = uuid4()
    expected = SimpleNamespace(
        equipment_id=uuid4(),
        asset_tag="ASSET-100",
    )
    repo.create_equipment.return_value = expected

    result = service.register_new_equipment(equipment_data, user_id)

    assert result is expected
    repo.create_equipment.assert_called_once_with(equipment_data, user_id)


def test_register_equipment_rejects_inactive_department(service, repo, equipment_data):
    repo.get_department_by_id.return_value = SimpleNamespace(
        department_id=equipment_data.department_id,
        is_active=False,
    )

    with pytest.raises(HTTPException) as exc:
        service.register_new_equipment(equipment_data, uuid4())

    assert exc.value.status_code == 422
    repo.create_equipment.assert_not_called()


def test_register_equipment_rejects_missing_department(service, repo, equipment_data):
    repo.get_department_by_id.return_value = None

    with pytest.raises(HTTPException) as exc:
        service.register_new_equipment(equipment_data, uuid4())

    assert exc.value.status_code == 422
    repo.create_equipment.assert_not_called()


def test_register_equipment_rejects_duplicate_asset_tag(service, repo, equipment_data):
    repo.get_by_asset_tag.return_value = SimpleNamespace(
        asset_tag=equipment_data.asset_tag
    )

    with pytest.raises(HTTPException) as exc:
        service.register_new_equipment(equipment_data, uuid4())

    assert exc.value.status_code == 409
    repo.create_equipment.assert_not_called()


def test_get_equipment_rejects_missing_record(service, repo):
    repo.get_equipment_by_id.return_value = None

    with pytest.raises(HTTPException) as exc:
        service.get_equipment(uuid4(), "health_manager")

    assert exc.value.status_code == 404


def test_clinical_staff_cannot_get_pending_equipment(service, repo):
    repo.get_equipment_by_id.return_value = SimpleNamespace(
        registration_status="pending"
    )

    with pytest.raises(HTTPException) as exc:
        service.get_equipment(uuid4(), "clinical_staff")

    assert exc.value.status_code == 403


def test_approve_pending_equipment_success(service, repo):
    equipment_id = uuid4()
    manager_id = uuid4()
    pending = SimpleNamespace(registration_status="pending")
    approved = SimpleNamespace(registration_status="approved")

    repo.get_equipment_by_id.return_value = pending
    repo.apply_approval.return_value = approved

    result = service.process_approval(equipment_id, manager_id)

    assert result.registration_status == "approved"
    repo.apply_approval.assert_called_once_with(pending, manager_id)


def test_approve_equipment_rejects_missing_record(service, repo):
    repo.get_equipment_by_id.return_value = None

    with pytest.raises(HTTPException) as exc:
        service.process_approval(uuid4(), uuid4())

    assert exc.value.status_code == 404
    repo.apply_approval.assert_not_called()


def test_approve_equipment_rejects_non_pending_record(service, repo):
    repo.get_equipment_by_id.return_value = SimpleNamespace(
        registration_status="approved"
    )

    with pytest.raises(HTTPException) as exc:
        service.process_approval(uuid4(), uuid4())

    assert exc.value.status_code == 409
    repo.apply_approval.assert_not_called()


def test_return_pending_equipment_success(service, repo):
    equipment_id = uuid4()
    pending = SimpleNamespace(registration_status="pending")
    returned = SimpleNamespace(registration_status="returned")

    repo.get_equipment_by_id.return_value = pending
    repo.apply_return.return_value = returned

    result = service.process_return(equipment_id)

    assert result.registration_status == "returned"
    repo.apply_return.assert_called_once_with(pending, reason=None)


def test_return_pending_equipment_passes_reason_to_repository(service, repo):
    equipment_id = uuid4()
    pending = SimpleNamespace(registration_status="pending")
    returned = SimpleNamespace(registration_status="returned")
    reason = "Missing supporting documentation"

    repo.get_equipment_by_id.return_value = pending
    repo.apply_return.return_value = returned

    result = service.process_return(equipment_id, reason=reason)

    assert result.registration_status == "returned"
    repo.apply_return.assert_called_once_with(pending, reason=reason)


def test_return_equipment_rejects_non_pending_record(service, repo):
    repo.get_equipment_by_id.return_value = SimpleNamespace(
        registration_status="approved"
    )

    with pytest.raises(HTTPException) as exc:
        service.process_return(uuid4())

    assert exc.value.status_code == 409
    repo.apply_return.assert_not_called()


def test_csv_import_rejects_invalid_utf8(service, repo):
    with pytest.raises(HTTPException) as exc:
        service.batch_import_csv(b"\xff\xfe\xfa", uuid4())

    assert exc.value.status_code == 400


def test_csv_import_rejects_missing_header(service, repo):
    with pytest.raises(HTTPException) as exc:
        service.batch_import_csv(b"", uuid4())

    assert exc.value.status_code == 400


def test_csv_import_rejects_missing_required_columns(service, repo):
    csv_content = "manufacturer,model_name\nAcme,Monitor X\n"

    with pytest.raises(HTTPException) as exc:
        service.batch_import_csv(csv_content.encode(), uuid4())

    assert exc.value.status_code == 400
    assert "Missing required CSV columns" in exc.value.detail
    repo.create_equipment.assert_not_called()


def test_csv_import_records_invalid_department_uuid(service, repo):
    csv_content = (
        "manufacturer,model_name,equipment_category,department_id,asset_tag,location\n"
        "Acme,Monitor X,Monitor,not-a-uuid,ASSET-101,Ward A\n"
    )

    result = service.batch_import_csv(csv_content.encode(), uuid4())

    assert result["imported_count"] == 0
    assert len(result["errors"]) == 1
    assert result["errors"][0]["row_number"] == 2
    repo.create_equipment.assert_not_called()


def test_csv_import_records_missing_department(service, repo):
    csv_content = (
        "manufacturer,model_name,equipment_category,department_id,asset_tag,location\n"
        f"Acme,Monitor X,Monitor,{uuid4()},ASSET-102,Ward A\n"
    )
    repo.get_department_by_id.return_value = None

    result = service.batch_import_csv(csv_content.encode(), uuid4())

    assert result["imported_count"] == 0
    assert len(result["errors"]) == 1
    assert result["errors"][0]["reason"] == (
        "Department does not exist or is inactive."
    )
    repo.create_equipment.assert_not_called()


def test_csv_import_records_duplicate_asset_tag(service, repo):
    department_id = uuid4()
    csv_content = (
        "manufacturer,model_name,equipment_category,department_id,asset_tag,location\n"
        f"Acme,Monitor X,Monitor,{department_id},ASSET-103,Ward A\n"
    )
    repo.get_department_by_id.return_value = SimpleNamespace(
        department_id=department_id,
        is_active=True,
    )
    repo.get_by_asset_tag.return_value = SimpleNamespace(asset_tag="ASSET-103")

    result = service.batch_import_csv(csv_content.encode(), uuid4())

    assert result["imported_count"] == 0
    assert len(result["errors"]) == 1
    assert "ASSET-103" in result["errors"][0]["reason"]
    repo.create_equipment.assert_not_called()


def test_csv_import_imports_valid_row(service, repo):
    department_id = uuid4()
    user_id = uuid4()
    csv_content = (
        "manufacturer,model_name,equipment_category,department_id,asset_tag,location\n"
        f"Acme,Monitor X,Monitor,{department_id},ASSET-104,Ward A\n"
    )
    repo.get_department_by_id.return_value = SimpleNamespace(
        department_id=department_id,
        is_active=True,
    )
    repo.get_by_asset_tag.return_value = None

    result = service.batch_import_csv(csv_content.encode(), user_id)

    assert result["imported_count"] == 1
    assert result["errors"] == []
    repo.create_equipment.assert_called_once()
    created_data = repo.create_equipment.call_args.args[0]
    assert created_data.asset_tag == "ASSET-104"
    assert repo.create_equipment.call_args.args[1] == user_id


@pytest.mark.anyio
async def test_document_upload_equipment_not_found(service, repo):
    repo.get_equipment_by_id.return_value = None

    upload = UploadFile(filename="manual.pdf", file=io.BytesIO(b"PDF content"))

    with pytest.raises(HTTPException) as exc:
        await service.process_document_vaulting(
            uuid4(), "manual", "Manual", upload, uuid4()
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "Equipment not found."


@pytest.mark.anyio
async def test_document_upload_missing_filename(service, repo):
    repo.get_equipment_by_id.return_value = SimpleNamespace(equipment_id=uuid4())

    upload = UploadFile(filename="", file=io.BytesIO(b"PDF content"))

    with pytest.raises(HTTPException) as exc:
        await service.process_document_vaulting(
            uuid4(), "manual", "Manual", upload, uuid4()
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "A file is required."


@pytest.mark.anyio
async def test_document_upload_empty_file(service, repo, monkeypatch):
    repo.get_equipment_by_id.return_value = SimpleNamespace(equipment_id=uuid4())
    upload = UploadFile(filename="manual.pdf", file=io.BytesIO(b""))

    with pytest.raises(HTTPException) as exc:
        await service.process_document_vaulting(
            uuid4(), "manual", "Manual", upload, uuid4()
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "The uploaded file is empty."


@pytest.mark.anyio
async def test_document_upload_too_large(service, repo, monkeypatch):
    repo.get_equipment_by_id.return_value = SimpleNamespace(equipment_id=uuid4())
    contents = b"x" * (service.MAX_FILE_SIZE + 1)
    upload = UploadFile(filename="manual.pdf", file=io.BytesIO(contents))

    with pytest.raises(HTTPException) as exc:
        await service.process_document_vaulting(
            uuid4(), "manual", "Manual", upload, uuid4()
        )

    assert exc.value.status_code == 413
    assert exc.value.detail == "Maximum file size is 10 MB."


@pytest.mark.anyio
async def test_document_upload_rejects_unsupported_type(service, repo, monkeypatch):
    repo.get_equipment_by_id.return_value = SimpleNamespace(equipment_id=uuid4())
    monkeypatch.setattr(
        "services.equipment.filetype.guess",
        lambda contents: None,
    )

    upload = UploadFile(filename="notes.txt", file=io.BytesIO(b"plain text"))

    with pytest.raises(HTTPException) as exc:
        await service.process_document_vaulting(
            uuid4(), "manual", "Notes", upload, uuid4()
        )

    assert exc.value.status_code == 415
    assert exc.value.detail == "Only PDF files are supported."


@pytest.mark.anyio
async def test_document_upload_valid_pdf_storage_not_configured(
    service, repo, monkeypatch
):
    repo.get_equipment_by_id.return_value = SimpleNamespace(equipment_id=uuid4())
    monkeypatch.setattr(
        "services.equipment.filetype.guess",
        lambda contents: SimpleNamespace(mime="application/pdf"),
    )

    upload = UploadFile(filename="manual.pdf", file=io.BytesIO(b"PDF content"))

    with pytest.raises(HTTPException) as exc:
        await service.process_document_vaulting(
            uuid4(), "manual", "Manual", upload, uuid4()
        )

    assert exc.value.status_code == 500
    assert exc.value.detail == "Document storage is not configured."


def test_retrieve_document_not_found(service, repo):
    repo.get_document_by_id.return_value = None

    with pytest.raises(HTTPException) as exc:
        service.retrieve_document(uuid4())

    assert exc.value.status_code == 404
    assert exc.value.detail == "Document metadata not found."


def test_retrieve_document_success(service, repo):
    document = SimpleNamespace(
        document_id=uuid4(),
        equipment_id=uuid4(),
        document_type="manual",
        document_name="Manual",
    )
    repo.get_document_by_id.return_value = document

    result = service.retrieve_document(document.document_id)

    assert result == document
    repo.get_document_by_id.assert_called_once_with(document.document_id)


@pytest.mark.parametrize(
    "role, allowed",
    [
        ("biomedical_engineer", True),
        ("health_manager", True),
        ("clinical_staff", False),
    ],
)
def test_retrieve_document_content_role_permissions(service, repo, role, allowed):
    from models import UserRole

    document = SimpleNamespace(
        document_id=uuid4(),
        equipment_id=uuid4(),
        document_type="manual",
        document_name="Manual",
        storage_key="pglo:123",
    )
    repo.get_document_by_id.return_value = document

    service.document_storage = MagicMock()
    service.document_storage.read.return_value = b"%PDF-1.4\nmock PDF content"

    user = SimpleNamespace(role=UserRole(role))

    if not allowed:
        with pytest.raises(HTTPException) as exc:
            service.retrieve_document_content(document.document_id, user)

        assert exc.value.status_code == 403
        service.document_storage.read.assert_not_called()
        return

    result_document, contents, filename, media_type = service.retrieve_document_content(
        document.document_id, user
    )

    assert result_document is document
    assert contents == b"%PDF-1.4\nmock PDF content"
    assert filename == "Manual"
    assert media_type == "application/pdf"
    service.document_storage.read.assert_called_once_with("pglo:123")


def test_retrieve_document_content_missing_metadata_returns_404(service, repo):
    from models import UserRole

    repo.get_document_by_id.return_value = None
    service.document_storage = MagicMock()
    user = SimpleNamespace(role=UserRole.BIOMEDICAL_ENGINEER)

    with pytest.raises(HTTPException) as exc:
        service.retrieve_document_content(uuid4(), user)

    assert exc.value.status_code == 404
    service.document_storage.read.assert_not_called()


def test_health_manager_can_list_all_active_departments(service, repo):
    from models import UserRole

    departments = [
        SimpleNamespace(department_id=uuid4(), is_active=True),
        SimpleNamespace(department_id=uuid4(), is_active=True),
    ]
    repo.get_all_departments.return_value = departments
    user = SimpleNamespace(
        role=UserRole.HEALTH_MANAGER,
        department_id=uuid4(),
    )

    result = service.list_departments(user)

    assert result == departments
    repo.get_all_departments.assert_called_once_with(active_only=True)


@pytest.mark.parametrize(
    "role",
    ["biomedical_engineer", "clinical_staff"],
)
def test_individual_user_sees_only_own_department(service, repo, role):
    own_department_id = uuid4()
    department = SimpleNamespace(
        department_id=own_department_id,
        is_active=True,
    )
    repo.get_department_by_id.return_value = department
    user = SimpleNamespace(
        role=role,
        department_id=own_department_id,
    )

    result = service.list_departments(user)

    assert result == [department]
    repo.get_department_by_id.assert_called_once_with(own_department_id)
    repo.get_all_departments.assert_not_called()


@pytest.mark.parametrize(
    "role",
    ["biomedical_engineer", "clinical_staff"],
)
def test_individual_user_cannot_get_another_department(service, repo, role):

    own_department_id = uuid4()
    other_department_id = uuid4()
    repo.get_department_by_id.return_value = SimpleNamespace(
        department_id=other_department_id,
        is_active=True,
    )
    user = SimpleNamespace(
        role=role,
        department_id=own_department_id,
    )

    with pytest.raises(HTTPException) as exc:
        service.get_department(other_department_id, user)

    assert exc.value.status_code == 404


def test_health_manager_can_get_another_department(service, repo):
    from models import UserRole

    department = SimpleNamespace(
        department_id=uuid4(),
        is_active=True,
    )
    repo.get_department_by_id.return_value = department
    user = SimpleNamespace(
        role=UserRole.HEALTH_MANAGER,
        department_id=uuid4(),
    )

    result = service.get_department(department.department_id, user)

    assert result is department


def test_health_manager_catalog_shows_all_equipment(service, repo):
    repo.list_all_equipment.return_value = []

    result = service.fetch_equipment_catalog("health_manager")

    assert result == []
    repo.list_all_equipment.assert_called_once_with(approved_only=False)


def test_delete_document_success():
    repo = MagicMock()
    storage = MagicMock()
    document = SimpleNamespace(storage_key="pglo:123")
    repo.get_document_by_id.return_value = document

    service = EquipmentService(repo, document_storage=storage)

    service.delete_document(uuid4())

    storage.delete.assert_called_once_with("pglo:123")
    repo.delete_document.assert_called_once_with(document)
    repo.commit.assert_called_once()
    repo.rollback.assert_not_called()


def test_delete_document_returns_404_when_missing():
    repo = MagicMock()
    storage = MagicMock()
    repo.get_document_by_id.return_value = None

    service = EquipmentService(repo, document_storage=storage)

    with pytest.raises(HTTPException) as exc:
        service.delete_document(uuid4())

    assert exc.value.status_code == 404
    storage.delete.assert_not_called()
    repo.delete_document.assert_not_called()
    repo.commit.assert_not_called()


def test_delete_document_rolls_back_when_metadata_deletion_fails():
    repo = MagicMock()
    storage = MagicMock()
    document = SimpleNamespace(storage_key="pglo:123")
    repo.get_document_by_id.return_value = document
    repo.delete_document.side_effect = RuntimeError("Database error")

    service = EquipmentService(repo, document_storage=storage)

    with pytest.raises(RuntimeError):
        service.delete_document(uuid4())

    storage.delete.assert_called_once_with("pglo:123")
    repo.rollback.assert_called_once()
    repo.commit.assert_not_called()


def test_health_manager_can_see_all_equipment(service, repo):
    equipment_records = [
        SimpleNamespace(registration_status="pending"),
        SimpleNamespace(registration_status="approved"),
    ]
    repo.list_all_equipment.return_value = equipment_records

    result = service.fetch_equipment_catalog("health_manager")

    assert result == equipment_records
    repo.list_all_equipment.assert_called_once_with(approved_only=False)


def test_clinical_staff_can_see_approved_equipment_only(service, repo):
    equipment_records = [
        SimpleNamespace(registration_status="approved"),
    ]
    repo.list_all_equipment.return_value = equipment_records

    result = service.fetch_equipment_catalog("clinical_staff")

    assert result == equipment_records
    repo.list_all_equipment.assert_called_once_with(approved_only=True)
