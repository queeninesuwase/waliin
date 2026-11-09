import { apiFetch, ApiError } from "./client";
import { assignFault, closeFault, getFault, setFaultStatus } from "./faults";

export type PriorityLevel = "critical" | "high" | "medium" | "low";

export interface PriorityItem {
  fault_id: string;
  equipment_id: string;
  equipment_name: string;
  asset_tag: string;
  department_name: string;
  fault_status: string;
  priority_score: number;
  priority_level: PriorityLevel | string;
  priority_explanation: string;
  severity_factor: number;
  clinical_criticality: number;
  backup_available: boolean;
  reported_at: string;
  downtime: string | null;
  still_down: boolean | null;
  assigned_engineer_id: string | null;
}

export interface FaultRow {
  fault_id: string;
  equipment_id: string;
  description: string;
  severity: string;
  status: string;
  reported_at: string;
}

export interface EquipmentBrief {
  equipment_id: string;
  manufacturer: string;
  model_name: string;
  asset_tag: string;
  location: string;
}

export type TestType =
  | "functional_test"
  | "safety_test"
  | "calibration"
  | "performance_test"
  | "commissioning";

export interface RepairRecord {
  record_id: string;
  fault_id: string;
  equipment_id: string;
  record_type: string;
  performed_by: string;
  work_performed: string | null;
  parts_used: string | null;
  repair_started_at: string | null;
  repair_completed_at: string | null;
  test_result: string | null;
  test_details: string | null;
  authorized_for_service: boolean;
  performed_at: string;
  released_at: string | null;
}

export interface RepairInput {
  work_performed: string;
  parts_used?: string | null;
  repair_started_at?: string | null;
  repair_completed_at?: string | null;
}

export interface TestInput {
  record_type: TestType;
  test_result: "pass" | "fail";
  test_details?: string | null;
}

export interface MaintenanceSummary {
  faults: { total_faults: number; open_faults: number; closed_faults: number };
  priorities: Record<PriorityLevel, number>;
  downtime: {
    equipment_still_down: number;
    total_downtime: string;
    average_downtime: string;
  };
  repairs: { repairs_completed: number; equipment_returned_to_service: number };
  resource_requests: { pending_requests: number; resolved_requests: number };
}

export const TEST_TYPES: { value: TestType; label: string }[] = [
  { value: "functional_test", label: "Functional test" },
  { value: "safety_test", label: "Electrical safety test" },
  { value: "calibration", label: "Calibration" },
  { value: "performance_test", label: "Performance test" },
  { value: "commissioning", label: "Commissioning" },
];

export const OPEN_STATUSES = new Set([
  "reported",
  "assigned",
  "under_inspection",
  "awaiting_resources",
  "under_repair",
  "awaiting_verification",
]);

function asEngineer(userId: string, body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "user-id": userId },
    body: JSON.stringify(body),
  };
}

export function getPriorityList() {
  return apiFetch<PriorityItem[]>("/faults/priority-list");
}

export function getFaults() {
  return apiFetch<FaultRow[]>("/fault-list?limit=1000");
}

export function getEquipmentBrief(equipmentId: string) {
  return apiFetch<EquipmentBrief>(
    `/equipment/${encodeURIComponent(equipmentId)}`,
  );
}

export function getFaultRecords(faultId: string) {
  return apiFetch<RepairRecord[]>(
    `/faults/${encodeURIComponent(faultId)}/records`,
  );
}

export function addRepair(faultId: string, userId: string, input: RepairInput) {
  return apiFetch<RepairRecord>(
    `/faults/${encodeURIComponent(faultId)}/repairs`,
    asEngineer(userId, input),
  );
}

export function addTest(faultId: string, userId: string, input: TestInput) {
  return apiFetch<RepairRecord>(
    `/faults/${encodeURIComponent(faultId)}/tests`,
    asEngineer(userId, input),
  );
}

export function releaseFault(faultId: string, userId: string, note: string) {
  return apiFetch<RepairRecord>(
    `/faults/${encodeURIComponent(faultId)}/release`,
    asEngineer(userId, { test_details: note.trim() || null }),
  );
}

export function statusAfterTest(result: "pass" | "fail") {
  return result === "pass" ? "awaiting_verification" : "under_repair";
}

export async function ensureAssigned(faultId: string, engineerId: string) {
  const fault = await getFault(faultId);
  if (!fault.assigned_engineer_id) {
    return assignFault(faultId, engineerId);
  }
  return fault;
}

export async function logRepair(
  faultId: string,
  engineerId: string,
  input: RepairInput,
) {
  await ensureAssigned(faultId, engineerId);
  const record = await addRepair(faultId, engineerId, input);
  await setFaultStatus(faultId, "under_repair", engineerId);
  return record;
}

export async function logTest(
  faultId: string,
  engineerId: string,
  input: TestInput,
) {
  await ensureAssigned(faultId, engineerId);
  const record = await addTest(faultId, engineerId, input);
  await setFaultStatus(faultId, statusAfterTest(input.test_result), engineerId);
  return record;
}

export async function returnToService(
  faultId: string,
  engineerId: string,
  note: string,
  alreadyReleased: boolean,
) {
  await ensureAssigned(faultId, engineerId);
  if (!alreadyReleased) {
    await releaseFault(faultId, engineerId, note);
  }
  await setFaultStatus(faultId, "verified", engineerId, note);
  return closeFault(
    faultId,
    engineerId,
    note.trim() || "Returned to service after passed tests",
  );
}

export function getMaintenanceSummary() {
  return apiFetch<MaintenanceSummary>("/reports/maintenance-summary");
}

export async function downloadMaintenancePdf() {
  let response: Response;
  try {
    response = await fetch("/api/reports/maintenance-summary/pdf", {
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection.");
  }
  if (!response.ok) {
    throw new ApiError(response.status, "Could not create the PDF. Try again.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `waliin-maintenance-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function durationHours(value: string | null | undefined) {
  if (!value) return 0;
  const match = value.match(
    /^(-)?P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/,
  );
  if (!match) return 0;
  const [, minus, days, hours, minutes, seconds] = match;
  const total =
    Number(days ?? 0) * 24 +
    Number(hours ?? 0) +
    Number(minutes ?? 0) / 60 +
    Number(seconds ?? 0) / 3600;
  return minus ? -total : total;
}

export function formatHours(hours: number) {
  if (hours <= 0) return "0 h";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours * 10) / 10} h`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours - days * 24);
  return rest ? `${days} d ${rest} h` : `${days} d`;
}

export function hoursSince(iso: string, now = Date.now()) {
  return Math.max(0, (now - Date.parse(iso)) / 3_600_000);
}

export function latestTest(records: RepairRecord[], type: TestType) {
  return [...records]
    .filter((record) => record.record_type === type)
    .sort((a, b) => Date.parse(b.performed_at) - Date.parse(a.performed_at))[0];
}

export function releaseChecklist(records: RepairRecord[]) {
  const repaired = records.some((record) => record.record_type === "repair");
  const functional =
    latestTest(records, "functional_test")?.test_result === "pass";
  const safety = latestTest(records, "safety_test")?.test_result === "pass";
  const released = records.some((record) => record.released_at !== null);
  return {
    repaired,
    functional,
    safety,
    released,
    ready: functional && safety && !released,
  };
}

export function levelOf(level: string): PriorityLevel {
  return level === "critical" || level === "high" || level === "medium"
    ? level
    : "low";
}

export function statusLabel(status: string) {
  const text = status.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function errorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    if (err.status === 0) return err.message;
    if (
      err.message &&
      err.message !== "Something went wrong. Please try again."
    )
      return err.message;
  }
  return fallback;
}
