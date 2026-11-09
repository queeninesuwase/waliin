from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas.priority_list import PriorityListItem
from services.priority_list_service import PriorityListService

router = APIRouter(
    prefix="/faults",
    tags=["Priority List"],
)

priority_list_service = PriorityListService()


@router.get(
    "/priority-list",
    response_model=list[PriorityListItem],
)
def get_priority_list(
    db: Session = Depends(get_db),
):
    return priority_list_service.get_priority_list(db)
