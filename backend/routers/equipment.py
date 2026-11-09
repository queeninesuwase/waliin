from typing import Annotated
from uuid import UUID

from fastapi.responses import Response
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserRole
from repositories.equipment import EquipmentRepository
from schemas.equipment import DocumentResponse
from schemas.equipment import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    EquipmentApprovalDecision,
    EquipmentCreate,
    EquipmentResponse,
    EquipmentUpdate,
)
from security.dependencies import get_current_user, require_role
from repositories.equipment_document_storage import EquipmentDocumentStorageRepository
from services.equipment import EquipmentService

router = APIRouter(prefix="/equipment", tags=["equipment"])

Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]

BiomedicalEngineer = Annotated[
    User,
    Depends(require_role(UserRole.BIOMEDICAL_ENGINEER)),
]

HealthManager = Annotated[
    User,
    Depends(require_role(UserRole.HEALTH_MANAGER)),
]


def get_equipment_service(db: Db) -> EquipmentService:
    return EquipmentService(
        EquipmentRepository(db),
        document_storage=EquipmentDocumentStorageRepository(db),
    )


Service = Annotated[EquipmentService, Depends(get_equipment_service)]


@router.post(
    "/departments",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_department(
    body: DepartmentCreate,
    manager: HealthManager,
    service: Service,
):
    return service.add_department(body)


@router.get(
    "/departments",
    response_model=list[DepartmentResponse],
)
def list_departments(
    user: CurrentUser,
    service: Service,
):
    return service.list_departments(user)


@router.delete(
    "/documents/{doc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_equipment_document(
    doc_id: UUID,
    manager: HealthManager,
    service: Service,
):
    service.delete_document(doc_id)


@router.get(
    "/departments/{department_id}",
    response_model=DepartmentResponse,
)
def get_department(
    department_id: UUID,
    user: CurrentUser,
    service: Service,
):
    return service.get_department(department_id, user)


@router.patch(
    "/departments/{department_id}",
    response_model=DepartmentResponse,
)
def update_department(
    department_id: UUID,
    body: DepartmentUpdate,
    manager: HealthManager,
    service: Service,
):
    return service.update_department(department_id, body)


@router.patch(
    "/departments/{department_id}/deactivate",
    response_model=DepartmentResponse,
)
def deactivate_department(
    department_id: UUID,
    manager: HealthManager,
    service: Service,
):
    return service.deactivate_department(department_id)


@router.post(
    "",
    response_model=EquipmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_equipment(
    body: EquipmentCreate,
    engineer: BiomedicalEngineer,
    service: Service,
):
    return service.register_new_equipment(
        body,
        engineer.user_id,
    )


@router.get(
    "",
    response_model=list[EquipmentResponse],
)
def list_equipment(
    user: CurrentUser,
    service: Service,
):
    return service.fetch_equipment_catalog(
        user.role.value if hasattr(user.role, "value") else user.role
    )


@router.get(
    "/pending",
    response_model=list[EquipmentResponse],
)
def list_pending_equipment(
    manager: HealthManager,
    service: Service,
):
    return service.list_pending_registrations()


@router.get(
    "/out-of-service",
    response_model=list[EquipmentResponse],
)
def list_out_of_service_equipment(
    user: CurrentUser,
    service: Service,
):
    return service.list_out_of_service_equipment()


@router.get(
    "/mine",
    response_model=list[EquipmentResponse],
)
def list_my_equipment(
    engineer: BiomedicalEngineer,
    service: Service,
):
    return service.list_my_equipment(engineer.user_id)


@router.post(
    "/{equipment_id}/resubmit",
    response_model=EquipmentResponse,
)
def resubmit_returned_equipment(
    equipment_id: UUID,
    body: EquipmentUpdate,
    engineer: BiomedicalEngineer,
    service: Service,
):
    return service.resubmit_returned_equipment(
        equipment_id=equipment_id,
        update_data=body,
        user=engineer,
    )


@router.get(
    "/{equipment_id}",
    response_model=EquipmentResponse,
)
def get_equipment(
    equipment_id: UUID,
    user: CurrentUser,
    service: Service,
):
    role = user.role.value if hasattr(user.role, "value") else user.role
    return service.get_equipment(equipment_id, role)


@router.patch(
    "/{equipment_id}",
    response_model=EquipmentResponse,
)
def update_equipment(
    equipment_id: UUID,
    body: EquipmentUpdate,
    user: CurrentUser,
    service: Service,
):
    return service.modify_equipment(
        equipment_id=equipment_id,
        update_data=body,
        user=user,
    )


@router.post(
    "/{equipment_id}/approve",
    response_model=EquipmentResponse,
)
def approve_equipment(
    equipment_id: UUID,
    manager: HealthManager,
    service: Service,
):
    return service.process_approval(
        equipment_id,
        manager.user_id,
    )


@router.post(
    "/{equipment_id}/return",
    response_model=EquipmentResponse,
)
def return_equipment(
    equipment_id: UUID,
    body: EquipmentApprovalDecision,
    manager: HealthManager,
    service: Service,
):
    return service.process_return(
        equipment_id=equipment_id,
        reason=body.reason,
    )


@router.post(
    "/{equipment_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_equipment_document(
    equipment_id: UUID,
    user: BiomedicalEngineer,
    service: Service,
    doc_type: str = Form(...),
    doc_name: str = Form(...),
    file: UploadFile = File(...),
):
    return await service.process_document_vaulting(
        equipment_id=equipment_id,
        doc_type=doc_type,
        doc_name=doc_name,
        upload=file,
        user_id=user.user_id,
    )


@router.get("/documents/{doc_id}/download")
def download_equipment_document(
    doc_id: UUID,
    user: CurrentUser,
    service: Service,
):
    _, contents, filename, media_type = service.retrieve_document_content(doc_id, user)

    return Response(
        content=contents,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import-csv")
async def import_equipment_csv(
    engineer: BiomedicalEngineer,
    service: Service,
    file: UploadFile = File(...),
):
    content = await file.read()

    return service.batch_import_csv(
        content,
        engineer.user_id,
        filename=file.filename,
    )
