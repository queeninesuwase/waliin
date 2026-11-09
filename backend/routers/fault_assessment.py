from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from fastapi import Header

from database import get_db
from models.user import User
from schemas.fault_assessment import FaultAssessmentCreate, FaultAssessmentRead
from services.assessment_service import AssessmentService

assessment_service = AssessmentService()


def create_fault_assessment_router(
    engineer_dependency: Callable,
    service: AssessmentService | None = None,
) -> APIRouter:
    router = APIRouter(
        prefix="/faults",
        tags=["Fault Assessments"],
    )

    router_service = service or assessment_service

    @router.post(
        "/{fault_id}/assessments",
        response_model=FaultAssessmentRead,
        status_code=status.HTTP_201_CREATED,
    )
    def create_assessment(
        fault_id: UUID,
        payload: FaultAssessmentCreate,
        db: Session = Depends(get_db),
        current_engineer: User = Depends(engineer_dependency),
    ):
        return router_service.create_assessment(
            db=db,
            fault_id=fault_id,
            assessed_by=current_engineer.user_id,
            data=payload,
        )

    @router.get(
        "/{fault_id}/assessments",
        response_model=list[FaultAssessmentRead],
    )
    def get_assessments(
        fault_id: UUID,
        db: Session = Depends(get_db),
        current_engineer: User = Depends(engineer_dependency),
    ):
        return router_service.get_fault_assessments(
            db=db,
            fault_id=fault_id,
        )

    return router


def get_dev_engineer(
    x_engineer_id: UUID = Header(..., alias="X-Engineer-Id"),
    db: Session = Depends(get_db),
) -> User:
    return assessment_service.get_engineer(
        db=db,
        engineer_id=x_engineer_id,
    )


router = create_fault_assessment_router(
    engineer_dependency=get_dev_engineer,
)
