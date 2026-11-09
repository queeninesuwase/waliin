from datetime import timedelta

from pydantic import BaseModel


class PriorityBreakdown(BaseModel):
    critical: int
    high: int
    medium: int
    low: int


class FaultSummary(BaseModel):
    total_faults: int
    open_faults: int
    closed_faults: int


class DowntimeSummary(BaseModel):
    equipment_still_down: int
    total_downtime: timedelta
    average_downtime: timedelta


class RepairSummary(BaseModel):
    repairs_completed: int
    equipment_returned_to_service: int


class ResourceRequestSummary(BaseModel):
    pending_requests: int
    resolved_requests: int


class MaintenanceReportSummary(BaseModel):
    faults: FaultSummary
    priorities: PriorityBreakdown
    downtime: DowntimeSummary
    repairs: RepairSummary
    resource_requests: ResourceRequestSummary
