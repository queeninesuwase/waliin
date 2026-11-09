import { apiFetch } from "@/lib/api/client";

export type FaultSummary = {
  total_faults: number;
  open_faults: number;
  closed_faults: number;
};

export type PriorityBreakdown = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type DowntimeSummary = {
  equipment_still_down: number;
  total_downtime: string;
  average_downtime: string;
};

export type RepairSummary = {
  repairs_completed: number;
  equipment_returned_to_service: number;
};

export type ResourceRequestSummary = {
  pending_requests: number;
  resolved_requests: number;
};

export type MaintenanceReportSummary = {
  faults: FaultSummary;
  priorities: PriorityBreakdown;
  downtime: DowntimeSummary;
  repairs: RepairSummary;
  resource_requests: ResourceRequestSummary;
};

export function getMaintenanceReportSummary() {
  return apiFetch<MaintenanceReportSummary>("/reports/maintenance-summary");
}
