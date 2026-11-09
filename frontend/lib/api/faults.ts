import { apiFetch } from "./client";

export type PriorityListItem = {
  fault_id: string;
  equipment_id: string;
  equipment_name: string;
  asset_tag: string;
  department_name: string;
  fault_status: string;
  priority_score: number;
  priority_level: string;
  priority_explanation: string;
  severity_factor: number;
  clinical_criticality: number;
  backup_available: boolean;
  reported_at: string;
  downtime: string | null;
  still_down: boolean | null;
  assigned_engineer_id: string | null;
};

export type FaultRecord = {
  fault_id: string;
  equipment_id: string;
  reported_by: string;
  assigned_engineer_id: string | null;
  description: string;
  severity: string;
  status: string;
  failure_observed_at: string | null;
  reported_at: string;
  out_of_service_at: string | null;
  updated_at: string;
  closed_at: string | null;
};

export type FaultEquipment = {
  equipment_id: string;
  manufacturer: string;
  model_name: string;
  equipment_category: string;
  asset_tag: string;
  serial_number: string | null;
  location: string;
  department_id: string;
  acquisition_type: string;
  service_status: string;
};

export type PriorityLevel = "low" | "medium" | "high" | "critical";

export type Assessment = {
  assessment_id: string;
  fault_id: string;
  assessed_by: string;
  assessed_at: string;
  findings: string;
  condition: string;
  recommended_action: string;
  severity_factor: number;
  clinical_criticality: number;
  backup_available: boolean;
  history_factor: number;
  priority_score: number;
  rule_priority_level: PriorityLevel;
  priority_level: PriorityLevel;
  priority_explanation: string;
  rule_version: string;
  is_current: boolean;
};

export type AssessmentInput = {
  findings: string;
  condition: string;
  recommended_action: string;
  severity_factor: number;
  clinical_criticality: number;
  backup_available: boolean;
  priority_level: PriorityLevel;
  priority_explanation: string;
};

export type RequestType =
  "spare_parts" | "technical_support" | "replacement_resource";

export type ResourceRequestInput = {
  request_type: RequestType;
  justification: string;
  related_fault_id?: string | null;
  items: {
    item_name_or_service: string;
    technical_specifications: string | null;
    quantity_requested: number;
  }[];
};

export type ResourceRequest = {
  request_id: string;
  request_number?: string;
  related_fault_id: string | null;
  request_type: string;
  justification: string;
  status: string | null;
  requested_at: string | null;
};

export type FaultRow = {
  faultId: string;
  equipmentId: string;
  equipmentName: string;
  assetTag: string;
  department: string;
  description: string;
  status: string;
  reportedAt: string;
  assessed: boolean;
  priorityLevel: string | null;
  priorityScore: number | null;
  assignedEngineerId: string | null;
};

export const REQUEST_TYPES: { value: RequestType; label: string }[] = [
  { value: "spare_parts", label: "Spare parts" },
  { value: "technical_support", label: "Outside technical help" },
  { value: "replacement_resource", label: "Replacement machine" },
];

export const CLOSED_STATUSES = new Set(["closed", "cancelled"]);

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function id(value: string) {
  return encodeURIComponent(value);
}

export function getPriorityList() {
  return apiFetch<PriorityListItem[]>("/faults/priority-list");
}

export function getAllFaults() {
  return apiFetch<FaultRecord[]>("/fault-list?limit=1000");
}

export function getFault(faultId: string) {
  return apiFetch<FaultRecord>(`/faults/${id(faultId)}`);
}

export function getFaultEquipment(equipmentId: string) {
  return apiFetch<FaultEquipment>(`/equipment/${id(equipmentId)}`);
}

export function assignFault(faultId: string, engineerId: string) {
  return apiFetch<FaultRecord>(`/faults/${id(faultId)}/assign`, {
    method: "POST",
    body: JSON.stringify({ assigned_engineer_id: engineerId }),
  });
}

export function setFaultStatus(
  faultId: string,
  status: string,
  engineerId: string,
  reason?: string,
) {
  return apiFetch<FaultRecord>(`/faults/${id(faultId)}/status`, {
    method: "POST",
    body: JSON.stringify({
      status,
      changed_by: engineerId,
      reason: reason?.trim() || null,
    }),
  });
}

export function markOutOfService(
  faultId: string,
  engineerId: string,
  status: string,
) {
  return apiFetch<FaultRecord>(`/faults/${id(faultId)}/status`, {
    method: "POST",
    body: JSON.stringify({
      status,
      changed_by: engineerId,
      reason: "Machine taken out of service",
      out_of_service_at: new Date().toISOString(),
    }),
  });
}

export function closeFault(
  faultId: string,
  engineerId: string,
  reason: string,
) {
  return apiFetch<FaultRecord>(`/faults/${id(faultId)}/close`, {
    method: "POST",
    body: JSON.stringify({
      changed_by: engineerId,
      reason: reason.trim() || null,
    }),
  });
}

export function getAssessments(faultId: string, engineerId: string) {
  return apiFetch<Assessment[]>(`/faults/${id(faultId)}/assessments`, {
    headers: { "X-Engineer-Id": engineerId },
  });
}

export function createAssessment(
  faultId: string,
  engineerId: string,
  input: AssessmentInput,
) {
  return apiFetch<Assessment>(`/faults/${id(faultId)}/assessments`, {
    method: "POST",
    headers: { "X-Engineer-Id": engineerId },
    body: JSON.stringify(input),
  });
}

export function createResourceRequest(
  engineerId: string,
  input: ResourceRequestInput,
) {
  return apiFetch<ResourceRequest>("/requests", {
    method: "POST",
    headers: { "user-id": engineerId },
    body: JSON.stringify(input),
  });
}

export function getResourceRequests() {
  return apiFetch<ResourceRequest[]>("/requests");
}

export function equipmentName(equipment: FaultEquipment | null | undefined) {
  if (!equipment) return "Unknown equipment";
  return equipment.model_name || equipment.manufacturer || "Unknown equipment";
}

export function buildFaultRows(
  faults: FaultRecord[],
  priority: PriorityListItem[],
  equipment: Map<string, FaultEquipment | null>,
  departments: Map<string, string>,
): FaultRow[] {
  const ranked = new Map(priority.map((item) => [item.fault_id, item]));
  const departmentByEquipment = new Map(
    priority.map((item) => [item.equipment_id, item.department_name]),
  );

  return faults
    .map((fault) => {
      const item = ranked.get(fault.fault_id);
      const machine = equipment.get(fault.equipment_id) ?? null;
      return {
        faultId: fault.fault_id,
        equipmentId: fault.equipment_id,
        equipmentName: item?.equipment_name ?? equipmentName(machine),
        assetTag: item?.asset_tag ?? machine?.asset_tag ?? "",
        department:
          item?.department_name ??
          (machine ? departments.get(machine.department_id) : undefined) ??
          departmentByEquipment.get(fault.equipment_id) ??
          "",
        description: fault.description,
        status: fault.status,
        reportedAt: fault.reported_at,
        assessed: Boolean(item),
        priorityLevel: item?.priority_level ?? null,
        priorityScore: item?.priority_score ?? null,
        assignedEngineerId: fault.assigned_engineer_id,
      };
    })
    .sort((a, b) => {
      if (a.assessed !== b.assessed) return a.assessed ? 1 : -1;
      const rank =
        (PRIORITY_ORDER[a.priorityLevel ?? ""] ?? 4) -
        (PRIORITY_ORDER[b.priorityLevel ?? ""] ?? 4);
      if (rank !== 0) return rank;
      return Date.parse(b.reportedAt) - Date.parse(a.reportedAt);
    });
}

export function checkResourceRequest(input: ResourceRequestInput) {
  if (!input.justification.trim()) return "Explain why this is needed.";
  const item = input.items[0];
  if (!item || !item.item_name_or_service.trim())
    return "Name the part, service or machine you need.";
  if (!Number.isInteger(item.quantity_requested) || item.quantity_requested < 1)
    return "Quantity must be at least 1.";
  return null;
}
