from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

AcquisitionType = Literal["donated", "purchased", "transferred", "unknown", "other"]
InstallationStatus = Literal[
    "unknown", "not_installed", "partially_installed", "installed", "commissioned"
]
ServiceStatus = Literal[
    "not_assessed",
    "in_service",
    "out_of_service",
    "under_maintenance",
    "not_installed",
    "incomplete",
    "retired",
]
DocumentType = Literal[
    "manual",
    "warranty",
    "donation_letter",
    "delivery_note",
    "installation_report",
    "calibration_certificate",
    "photo",
    "other",
]


class DepartmentCreate(BaseModel):
    department_name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    responsible_engineer_id: UUID | None = None
    is_active: bool = True


class DepartmentUpdate(BaseModel):
    department_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    description: str | None = None
    responsible_engineer_id: UUID | None = None
    is_active: bool | None = None


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    department_id: UUID
    department_name: str
    description: str | None
    responsible_engineer_id: UUID | None = None
    responsible_engineer_role: str
    is_active: bool
    created_at: datetime


class EquipmentCreate(BaseModel):
    manufacturer: str = Field(min_length=1, max_length=120)
    model_name: str = Field(min_length=1, max_length=120)
    model_number: str | None = Field(default=None, max_length=80)
    equipment_category: str = Field(min_length=1, max_length=100)
    department_id: UUID
    asset_tag: str = Field(min_length=1, max_length=80)
    serial_number: str | None = Field(default=None, max_length=120)
    location: str = Field(min_length=1, max_length=160)
    acquisition_type: AcquisitionType = "unknown"
    donor_or_supplier: str | None = Field(default=None, max_length=180)
    received_at: datetime | None = None
    installation_status: InstallationStatus = "unknown"
    service_status: ServiceStatus = "not_assessed"
    warranty_start_date: date | None = None
    warranty_end_date: date | None = None

    @field_validator("manufacturer")
    @classmethod
    def validate_manufacturer(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Manufacturer cannot be blank")
        return value


class EquipmentUpdate(BaseModel):
    manufacturer: str | None = Field(default=None, min_length=1, max_length=120)
    model_name: str | None = Field(default=None, min_length=1, max_length=120)
    model_number: str | None = Field(default=None, max_length=80)
    equipment_category: str | None = Field(default=None, min_length=1, max_length=100)
    department_id: UUID | None = None
    asset_tag: str | None = Field(default=None, min_length=1, max_length=80)
    serial_number: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, min_length=1, max_length=160)
    acquisition_type: AcquisitionType | None = None
    donor_or_supplier: str | None = Field(default=None, max_length=180)
    received_at: datetime | None = None
    installation_status: InstallationStatus | None = None
    service_status: ServiceStatus | None = None
    warranty_start_date: date | None = None
    warranty_end_date: date | None = None


class EquipmentApprovalDecision(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)


class EquipmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    equipment_id: UUID
    manufacturer: str
    model_name: str
    model_number: str | None
    equipment_category: str
    department_id: UUID
    asset_tag: str
    serial_number: str | None
    location: str
    acquisition_type: AcquisitionType
    registration_status: str
    installation_status: InstallationStatus
    service_status: ServiceStatus
    registered_by: UUID
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    created_at: datetime


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document_id: UUID
    equipment_id: UUID
    document_type: DocumentType
    document_name: str
    storage_key: str
    uploaded_by: UUID
    uploaded_at: datetime
