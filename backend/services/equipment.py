import csv
import io
import filetype
import re
from typing import Any
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from models import User, UserRole
from models.department import Department
from models.equipment import Equipment
from models.equipment_document import EquipmentDocument
from repositories.equipment import EquipmentRepository
from repositories.equipment_document_storage import EquipmentDocumentStorageRepository
from schemas.equipment import (
    DepartmentCreate,
    DepartmentUpdate,
    EquipmentCreate,
    EquipmentUpdate,
)


class EquipmentService:
    MAX_FILE_SIZE = 10 * 1024 * 1024

    ALLOWED_MIME_TYPES = {
        "application/pdf",
    }

    def __init__(
        self,
        repo: EquipmentRepository,
        document_storage: EquipmentDocumentStorageRepository | None = None,
    ):
        self.repo = repo
        self.document_storage = document_storage

    def add_department(self, data: DepartmentCreate) -> Department:
        try:
            return self.repo.create_department(data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The department conflicts with an existing record.",
            ) from exc

    def get_department(self, dept_id: UUID, user: User) -> Department:
        department = self.repo.get_department_by_id(dept_id)

        if department is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found.",
            )

        role = user.role.value if hasattr(user.role, "value") else user.role
        is_manager = role == UserRole.HEALTH_MANAGER.value

        if not is_manager and user.department_id != dept_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found.",
            )

        return department

    def list_departments(self, user: User) -> list[Department]:
        role = user.role.value if hasattr(user.role, "value") else user.role

        if role == UserRole.HEALTH_MANAGER.value:
            return self.repo.get_all_departments(active_only=True)

        if user.department_id is None:
            return []

        department = self.repo.get_department_by_id(user.department_id)

        if department is None or not department.is_active:
            return []

        return [department]

    def update_department(
        self,
        dept_id: UUID,
        update_data: DepartmentUpdate,
    ) -> Department:
        department = self.repo.get_department_by_id(dept_id)

        if department is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found.",
            )

        try:
            return self.repo.update_department(department, update_data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The department update conflicts with an existing record.",
            ) from exc

    def deactivate_department(self, dept_id: UUID) -> Department:
        department = self.repo.get_department_by_id(dept_id)

        if department is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found.",
            )

        if not department.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The department is already inactive.",
            )

        try:
            return self.repo.deactivate_department(department)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The department could not be deactivated.",
            ) from exc

    def register_new_equipment(
        self,
        data: EquipmentCreate,
        user_id: UUID,
    ) -> Equipment:
        department = self.repo.get_department_by_id(data.department_id)

        if department is None or not department.is_active:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Select an existing active department.",
            )

        if self.repo.get_by_asset_tag(data.asset_tag):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This asset tag is already registered.",
            )

        try:
            return self.repo.create_equipment(data, user_id)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The asset tag or another equipment constraint conflicts.",
            ) from exc

    def get_equipment(
        self,
        equipment_id: UUID,
        current_user_role: str,
    ) -> Equipment:
        equipment = self.repo.get_equipment_by_id(equipment_id)

        if equipment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Equipment not found.",
            )

        if (
            current_user_role == "clinical_staff"
            and equipment.registration_status != "approved"
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This equipment registration has not been approved.",
            )

        return equipment

    def list_my_equipment(self, user_id: UUID) -> list[Equipment]:
        return self.repo.list_equipment_registered_by(user_id)

    def fetch_equipment_catalog(
        self,
        current_user_role: str,
    ) -> list[Equipment]:
        return self.repo.list_all_equipment(
            approved_only=current_user_role == "clinical_staff"
        )

    def modify_equipment(
        self,
        equipment_id: UUID,
        update_data: EquipmentUpdate,
        user: User,
    ) -> Equipment:
        equipment = self.repo.get_equipment_by_id(equipment_id)

        if equipment is None or equipment.registered_by != user.user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Equipment not found.",
            )

        if equipment.registration_status != "returned":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only returned registrations can be edited. Use resubmit after correcting the details.",
            )

        department_id = update_data.department_id
        if department_id is not None:
            department = self.repo.get_department_by_id(department_id)
            if department is None or not department.is_active:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Select an existing active department.",
                )

        try:
            return self.repo.update_equipment(equipment, update_data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The equipment update conflicts with a database constraint.",
            ) from exc

    def resubmit_returned_equipment(
        self,
        equipment_id: UUID,
        update_data: EquipmentUpdate,
        user: User,
    ) -> Equipment:
        equipment = self.repo.get_equipment_by_id(equipment_id)

        if equipment is None or equipment.registered_by != user.user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Equipment not found.",
            )

        if equipment.registration_status != "returned":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only returned registrations can be resubmitted.",
            )

        department_id = update_data.department_id
        if department_id is not None:
            department = self.repo.get_department_by_id(department_id)
            if department is None or not department.is_active:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Select an existing active department.",
                )

        try:
            return self.repo.resubmit_returned_equipment(equipment, update_data)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The corrected registration conflicts with an existing record.",
            ) from exc

    def list_out_of_service_equipment(self) -> list[Equipment]:
        return self.repo.list_out_of_service_equipment()

    def list_pending_registrations(self) -> list[Equipment]:
        return self.repo.list_pending_equipment()

    def process_approval(
        self,
        equipment_id: UUID,
        manager_id: UUID,
    ) -> Equipment:
        equipment = self.repo.get_equipment_by_id(equipment_id)

        if equipment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Equipment not found.",
            )

        if equipment.registration_status != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only pending registrations can be approved.",
            )

        try:
            return self.repo.apply_approval(equipment, manager_id)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The approval could not be saved.",
            ) from exc

    def process_return(
        self,
        equipment_id: UUID,
        reason: str | None = None,
    ) -> Equipment:
        equipment = self.repo.get_equipment_by_id(equipment_id)

        if equipment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Equipment not found.",
            )

        if equipment.registration_status != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only pending registrations can be returned.",
            )

        try:
            return self.repo.apply_return(equipment, reason=reason)
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The registration could not be returned.",
            ) from exc

    def validate_csv_upload(
        self,
        filename: str | None,
        content: bytes,
    ) -> None:
        if filename is not None and not filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Please upload a CSV file.",
            )

        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded CSV file is empty.",
            )

    def batch_import_csv(
        self,
        file_bytes: bytes,
        user_id: UUID,
        filename: str | None = None,
    ) -> dict[str, Any]:
        self.validate_csv_upload(
            filename=filename,
            content=file_bytes,
        )

        try:
            content = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The CSV file must use UTF-8 encoding.",
            ) from exc

        reader = csv.DictReader(io.StringIO(content))

        required_columns = {
            "manufacturer",
            "model_name",
            "equipment_category",
            "department_id",
            "asset_tag",
            "location",
        }

        if not reader.fieldnames:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The CSV file is missing its header row.",
            )

        actual_columns = {column.strip() for column in reader.fieldnames if column}

        missing_columns = required_columns - actual_columns

        if missing_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Missing required CSV columns: "
                    + ", ".join(sorted(missing_columns))
                ),
            )

        summary: dict[str, Any] = {
            "imported_count": 0,
            "errors": [],
            "imported_equipment": [],
        }

        for row_number, row in enumerate(reader, start=2):
            try:
                department_id = UUID((row.get("department_id") or "").strip())

                payload = EquipmentCreate(
                    manufacturer=(row.get("manufacturer") or "").strip(),
                    model_name=(row.get("model_name") or "").strip(),
                    model_number=((row.get("model_number") or "").strip() or None),
                    equipment_category=((row.get("equipment_category") or "").strip()),
                    department_id=department_id,
                    asset_tag=(row.get("asset_tag") or "").strip(),
                    serial_number=((row.get("serial_number") or "").strip() or None),
                    location=(row.get("location") or "").strip(),
                    acquisition_type=(
                        (row.get("acquisition_type") or "unknown").strip()
                    ),
                    donor_or_supplier=(
                        (row.get("donor_or_supplier") or "").strip() or None
                    ),
                    installation_status=(
                        (row.get("installation_status") or "unknown").strip()
                    ),
                )
            except (ValueError, ValidationError) as exc:
                summary["errors"].append(
                    {
                        "row_number": row_number,
                        "reason": str(exc),
                    }
                )
                continue

            department = self.repo.get_department_by_id(payload.department_id)

            if department is None or not department.is_active:
                summary["errors"].append(
                    {
                        "row_number": row_number,
                        "reason": "Department does not exist or is inactive.",
                    }
                )
                continue

            if self.repo.get_by_asset_tag(payload.asset_tag):
                summary["errors"].append(
                    {
                        "row_number": row_number,
                        "reason": (f"Asset tag '{payload.asset_tag}' already exists."),
                    }
                )
                continue

            try:
                equipment = self.repo.create_equipment(payload, user_id)
                summary["imported_count"] += 1
                summary["imported_equipment"].append(
                    {
                        "equipment_id": str(equipment.equipment_id),
                        "asset_tag": equipment.asset_tag,
                        "manufacturer": equipment.manufacturer,
                        "model_name": equipment.model_name,
                    }
                )

            except IntegrityError:
                self.repo.rollback()
                summary["errors"].append(
                    {
                        "row_number": row_number,
                        "reason": "The row conflicts with a database constraint.",
                    }
                )

            except Exception:
                self.repo.rollback()
                raise

        return summary

    async def process_document_vaulting(
        self,
        equipment_id: UUID,
        doc_type: str,
        doc_name: str,
        upload: UploadFile,
        user_id: UUID,
    ) -> EquipmentDocument:
        equipment = self.repo.get_equipment_by_id(equipment_id)

        if equipment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Equipment not found.",
            )

        if not upload.filename or not upload.filename.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A file is required.",
            )

        allowed_doc_types = {
            "manual",
            "warranty",
            "donation_letter",
            "delivery_note",
            "installation_report",
            "calibration_certificate",
            "photo",
            "other",
        }
        if doc_type not in allowed_doc_types:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid document type.",
            )

        contents = await upload.read()

        if not contents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file is empty.",
            )

        if len(contents) > self.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="Maximum file size is 10 MB.",
            )

        detected_file = filetype.guess(contents)
        detected_type = detected_file.mime if detected_file else None

        if detected_type not in self.ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only PDF files are supported.",
            )

        if self.document_storage is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Document storage is not configured.",
            )

        try:
            storage_key = self.document_storage.store(contents)
            document = self.repo.create_document(
                equipment_id=equipment_id,
                doc_type=doc_type,
                name=(doc_name.strip() or upload.filename),
                key=storage_key,
                user_id=user_id,
            )
            self.repo.commit()
            return document
        except Exception:
            self.repo.rollback()
            raise

    def delete_document(self, doc_id: UUID) -> None:
        document = self.repo.get_document_by_id(doc_id)

        if document is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found.",
            )

        if self.document_storage is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Document storage is not configured.",
            )

        try:
            self.document_storage.delete(document.storage_key)
            self.repo.delete_document(document)
            self.repo.commit()
        except Exception:
            self.repo.rollback()
            raise

    def retrieve_document(self, doc_id: UUID) -> EquipmentDocument:
        document = self.repo.get_document_by_id(doc_id)

        if document is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document metadata not found.",
            )

        return document

    def retrieve_document_content(self, doc_id: UUID, user: User):
        role = user.role.value if hasattr(user.role, "value") else user.role
        allowed_roles = {
            UserRole.BIOMEDICAL_ENGINEER.value,
            UserRole.HEALTH_MANAGER.value,
        }

        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view documents.",
            )

        document = self.retrieve_document(doc_id)

        if self.document_storage is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Document storage is not configured.",
            )

        try:
            contents = self.document_storage.read(document.storage_key)
        except (FileNotFoundError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stored document was not found.",
            ) from exc

        filename = (
            re.sub(r'[\r\n"\\]', "_", document.document_name).strip() or "document"
        )
        detected_file = filetype.guess(contents)
        media_type = detected_file.mime if detected_file else "application/octet-stream"

        return document, contents, filename, media_type
