import { listDepartments, type Department } from "@/features/departments/api";
import {
  listEquipment,
  listPendingEquipment,
  type Equipment,
} from "@/features/equipment/api";
import {
  getMaintenanceReportSummary,
  type MaintenanceReportSummary,
} from "@/features/reports/api";
import { getRequests, type ResourceRequest } from "@/features/requests/api";
import { apiFetch } from "@/lib/api/client";
import type { paths } from "@/lib/api/openapi";

export type DashboardSummary =
  paths["/dashboard/summary"]["get"]["responses"][200]["content"]["application/json"];

export type FaultRecord = {
  fault_id: string;
  equipment_id: string;
  reported_by: string;
  assigned_engineer_id: string | null;
  description: string;
  severity: string;
  status: string;
  reported_at: string;
  out_of_service_at: string | null;
  updated_at: string;
  closed_at: string | null;
};

export type PriorityItem = {
  fault_id: string;
  equipment_id: string;
  equipment_name: string;
  asset_tag: string;
  department_name: string;
  fault_status: string;
  priority_score: number;
  priority_level: string;
  priority_explanation: string;
  backup_available: boolean;
  reported_at: string;
  still_down: boolean | null;
  assigned_engineer_id: string | null;
};

export type DashboardData = {
  faults: FaultRecord[];
  priority: PriorityItem[];
  equipment: Equipment[];
  pendingEquipment: Equipment[];
  outOfService: Equipment[];
  departments: Department[];
  requests: ResourceRequest[];
  overdue: ResourceRequest[];
  report: MaintenanceReportSummary | null;
  failed: Source[];
};

export function getDashboardSummary() {
  return apiFetch<DashboardSummary>("/dashboard/summary");
}

export function getFaults() {
  return apiFetch<FaultRecord[]>("/fault-list?limit=1000");
}

export function getPriorityList() {
  return apiFetch<PriorityItem[]>("/faults/priority-list");
}

export function getOutOfServiceEquipment() {
  return apiFetch<Equipment[]>("/equipment/out-of-service");
}

export function getOverdueRequests() {
  return apiFetch<ResourceRequest[]>("/requests/overdue");
}

export type Source =
  | "faults"
  | "priority"
  | "equipment"
  | "pending"
  | "outOfService"
  | "departments"
  | "requests"
  | "overdue"
  | "report";

export const SOURCE_LABEL: Record<Source, string> = {
  faults: "faults",
  priority: "priority list",
  equipment: "equipment",
  pending: "pending registrations",
  outOfService: "out-of-service equipment",
  departments: "departments",
  requests: "requests",
  overdue: "overdue follow-ups",
  report: "maintenance report",
};

async function attempt<T>(
  source: Source,
  load: () => Promise<T>,
  fallback: T,
  failed: Source[],
) {
  try {
    return await load();
  } catch {
    failed.push(source);
    return fallback;
  }
}

export async function loadDashboard(): Promise<DashboardData> {
  const failed: Source[] = [];
  const [
    faults,
    priority,
    equipment,
    pendingEquipment,
    outOfService,
    departments,
    requests,
    overdue,
    report,
  ] = await Promise.all([
    attempt("faults", getFaults, [], failed),
    attempt("priority", getPriorityList, [], failed),
    attempt("equipment", listEquipment, [], failed),
    attempt("pending", listPendingEquipment, [], failed),
    attempt("outOfService", getOutOfServiceEquipment, [], failed),
    attempt("departments", listDepartments, [], failed),
    attempt("requests", getRequests, [], failed),
    attempt("overdue", getOverdueRequests, [], failed),
    attempt("report", getMaintenanceReportSummary, null, failed),
  ]);

  if (failed.length === 9) {
    throw new Error("Could not load dashboard information.");
  }

  return {
    faults,
    priority,
    equipment,
    pendingEquipment,
    outOfService,
    departments,
    requests,
    overdue,
    report,
    failed,
  };
}
