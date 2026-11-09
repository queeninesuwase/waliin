from sqlalchemy.orm import Session

from repositories.priority_list_repository import PriorityListRepository
from schemas.priority_list import PriorityListItem


class PriorityListService:
    def __init__(
        self,
        repository: PriorityListRepository | None = None,
    ):
        self.repository = repository or PriorityListRepository()

    def get_priority_list(self, db: Session) -> list[PriorityListItem]:
        rows = self.repository.get_priority_list(db)

        return [PriorityListItem.model_validate(row) for row in rows]
