from pydantic import BaseModel


class DashboardSummary(BaseModel):
    active_faults: int
    critical_faults: int
    high_priority_faults: int
    equipment_down: int
    equipment_under_maintenance: int
