from sqlalchemy.orm import Session

from models.enums import PriorityLevel, ServiceStatus
from repositories.dashboard_repository import DashboardRepository
from schemas.dashboard import DashboardSummary


class DashboardService:
    def __init__(
        self,
        repository: DashboardRepository | None = None,
    ):
        self.repository = repository or DashboardRepository()

    def get_summary(self, db: Session) -> DashboardSummary:
        return DashboardSummary(
            active_faults=self.repository.count_active_faults(db),
            critical_faults=self.repository.count_priority_faults(
                db,
                PriorityLevel.CRITICAL,
            ),
            high_priority_faults=self.repository.count_priority_faults(
                db,
                PriorityLevel.HIGH,
            ),
            equipment_down=self.repository.count_equipment_by_service_status(
                db,
                ServiceStatus.OUT_OF_SERVICE,
            ),
            equipment_under_maintenance=(
                self.repository.count_equipment_by_service_status(
                    db,
                    ServiceStatus.UNDER_MAINTENANCE,
                )
            ),
        )
