import type { Department } from "@/features/departments/api";
import type { Equipment } from "@/features/equipment/api";
import type { ResourceRequest } from "@/features/requests/api";

import type { DashboardData, FaultRecord, PriorityItem, Source } from "./api";

export type Level = "critical" | "high" | "medium" | "low" | "unassessed";

export const LEVELS: Level[] = [
  "critical",
  "high",
  "medium",
  "low",
  "unassessed",
];

export const LEVEL_LABEL: Record<Level, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  unassessed: "Not assessed",
};

export const LEVEL_COLOR: Record<Level, string> = {
  critical: "#dc2626",
  high: "#f97316",
  medium: "#d9a00a",
  low: "#10b981",
  unassessed: "#a8a29e",
};

export const CLOSED = new Set(["closed", "cancelled"]);

const DAY = 86_400_000;

export const REQUEST_TYPE_LABEL: Record<string, string> = {
  spare_parts: "Spare parts",
  technical_support: "Outside help",
  replacement_resource: "Replacement machines",
  new_equipment: "New equipment",
};

const OPEN_REQUEST = new Set([
  "pending",
  "approved",
  "in_progress",
  "returned",
]);

export type OpenFaultRow = {
  faultId: string;
  equipmentId: string;
  name: string;
  assetTag: string;
  department: string;
  level: Level;
  status: string;
  description: string;
  days: number;
};

export type DepartmentRow = {
  department: string;
  counts: Record<Level, number>;
  total: number;
};

export type TrendBucket = {
  label: string;
  start: number;
  reported: number;
  closed: number;
};

export function levelOf(value: string | null | undefined): Level {
  return value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
    ? value
    : "unassessed";
}

export function daysBetween(from: string, now: number) {
  const start = Date.parse(from);
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / DAY));
}

export function durationHours(value: string | null | undefined) {
  if (!value) return 0;
  const match = value.match(
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/,
  );
  if (!match) return 0;
  const [, days, hours, minutes, seconds] = match;
  return (
    Number(days ?? 0) * 24 +
    Number(hours ?? 0) +
    Number(minutes ?? 0) / 60 +
    Number(seconds ?? 0) / 3600
  );
}

export function formatHours(hours: number) {
  if (hours <= 0) return "0 h";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours * 10) / 10} h`;
  return `${Math.round((hours / 24) * 10) / 10} days`;
}

function departmentNames(departments: Department[]) {
  return new Map(
    departments.map((item) => [item.department_id, item.department_name]),
  );
}

function equipmentById(equipment: Equipment[]) {
  return new Map(equipment.map((item) => [item.equipment_id, item]));
}

export function allFaults(data: DashboardData): FaultRecord[] {
  const known = new Set(data.faults.map((fault) => fault.fault_id));
  const rankedOnly = data.priority
    .filter((item) => !known.has(item.fault_id))
    .map((item): FaultRecord => ({
      fault_id: item.fault_id,
      equipment_id: item.equipment_id,
      reported_by: "",
      assigned_engineer_id: item.assigned_engineer_id,
      description: item.priority_explanation,
      severity: item.priority_level,
      status: item.fault_status,
      reported_at: item.reported_at,
      out_of_service_at: null,
      updated_at: item.reported_at,
      closed_at: null,
    }));

  return [...data.faults, ...rankedOnly];
}

export function openFaultRows(data: DashboardData, now: number) {
  const ranked = new Map(data.priority.map((item) => [item.fault_id, item]));
  const machines = equipmentById([
    ...data.equipment,
    ...data.pendingEquipment,
    ...data.outOfService,
  ]);
  const names = departmentNames(data.departments);

  return allFaults(data)
    .filter((fault) => !CLOSED.has(fault.status))
    .map((fault): OpenFaultRow => {
      const item = ranked.get(fault.fault_id);
      const machine = machines.get(fault.equipment_id);
      return {
        faultId: fault.fault_id,
        equipmentId: fault.equipment_id,
        name: item?.equipment_name ?? machine?.model_name ?? "Equipment",
        assetTag: item?.asset_tag ?? machine?.asset_tag ?? "",
        department:
          item?.department_name ??
          (machine ? names.get(machine.department_id) : undefined) ??
          "Unknown",
        level: levelOf(item?.priority_level),
        status: fault.status,
        description: fault.description,
        days: daysBetween(fault.out_of_service_at ?? fault.reported_at, now),
      };
    })
    .sort((a, b) => {
      const rank = LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level);
      return rank !== 0 ? rank : b.days - a.days;
    });
}

export function levelCounts(rows: OpenFaultRow[]) {
  const counts: Record<Level, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unassessed: 0,
  };
  for (const row of rows) counts[row.level] += 1;
  return counts;
}

export function departmentRows(rows: OpenFaultRow[]): DepartmentRow[] {
  const byName = new Map<string, DepartmentRow>();
  for (const row of rows) {
    const entry = byName.get(row.department) ?? {
      department: row.department,
      counts: { critical: 0, high: 0, medium: 0, low: 0, unassessed: 0 },
      total: 0,
    };
    entry.counts[row.level] += 1;
    entry.total += 1;
    byName.set(row.department, entry);
  }
  return [...byName.values()].sort((a, b) => b.total - a.total);
}

export function trendBuckets(
  faults: FaultRecord[],
  periodDays: number,
  now: number,
): TrendBucket[] {
  const size = periodDays > 31 ? 7 : 1;
  const count = Math.ceil(periodDays / size);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const end = today.getTime() + DAY;
  const first = end - count * size * DAY;

  const buckets: TrendBucket[] = Array.from({ length: count }, (_, index) => {
    const start = first + index * size * DAY;
    return {
      label: new Date(start).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
      start,
      reported: 0,
      closed: 0,
    };
  });

  const place = (iso: string | null, key: "reported" | "closed") => {
    if (!iso) return;
    const time = Date.parse(iso);
    if (Number.isNaN(time) || time < first || time >= end) return;
    buckets[Math.floor((time - first) / (size * DAY))][key] += 1;
  };

  for (const fault of faults) {
    place(fault.reported_at, "reported");
    if (fault.status === "closed") place(fault.closed_at, "closed");
  }
  return buckets;
}

export function periodStats(
  faults: FaultRecord[],
  periodDays: number,
  now: number,
) {
  const since = now - periodDays * DAY;
  const inPeriod = (iso: string | null) =>
    iso !== null && Date.parse(iso) >= since;
  const closed = faults.filter(
    (fault) => fault.status === "closed" && inPeriod(fault.closed_at),
  );
  const repairHours = closed
    .map(
      (fault) =>
        (Date.parse(fault.closed_at ?? "") -
          Date.parse(fault.out_of_service_at ?? fault.reported_at)) /
        3_600_000,
    )
    .filter((hours) => Number.isFinite(hours) && hours >= 0);
  return {
    reported: faults.filter((fault) => inPeriod(fault.reported_at)).length,
    backInUse: closed.length,
    averageRepairHours: repairHours.length
      ? repairHours.reduce((sum, hours) => sum + hours, 0) / repairHours.length
      : 0,
  };
}

export function approvedEquipment(equipment: DashboardData["equipment"]) {
  return equipment.filter(
    (item) =>
      !item.registration_status || item.registration_status === "approved",
  );
}

export function availability(data: DashboardData) {
  const approved = approvedEquipment(data.equipment);
  const ids = new Set(approved.map((item) => item.equipment_id));
  const total = approved.length;
  const down = new Set([
    ...data.outOfService
      .map((item) => item.equipment_id)
      .filter((id) => ids.has(id)),
    ...approved
      .filter(
        (item) =>
          item.service_status === "out_of_service" ||
          item.service_status === "under_maintenance",
      )
      .map((item) => item.equipment_id),
  ]).size;
  const unavailable = Math.min(total, down);
  return {
    total,
    unavailable,
    percent: total ? Math.round(((total - unavailable) / total) * 100) : 100,
  };
}

export function pendingDecisions(requests: ResourceRequest[]) {
  return requests
    .filter((request) => (request.status ?? "pending") === "pending")
    .sort(
      (a, b) =>
        Date.parse(a.requested_at ?? "") - Date.parse(b.requested_at ?? ""),
    );
}

export function requestOutlook(requests: ResourceRequest[]) {
  const rows = new Map<
    string,
    { type: string; requests: number; items: number }
  >();
  for (const request of requests) {
    if (!OPEN_REQUEST.has((request.status ?? "pending").toLowerCase()))
      continue;
    const entry = rows.get(request.request_type) ?? {
      type: request.request_type,
      requests: 0,
      items: 0,
    };
    entry.requests += 1;
    entry.items += (request.items ?? []).reduce(
      (sum, item) => sum + (item.quantity_requested ?? 0),
      0,
    );
    rows.set(request.request_type, entry);
  }
  return [...rows.values()].sort((a, b) => b.requests - a.requests);
}

export function requestLabel(request: ResourceRequest) {
  return REQUEST_TYPE_LABEL[request.request_type] ?? request.request_type;
}

export function requestTitle(request: ResourceRequest) {
  const item = request.items?.[0];
  return item?.item_name || request.justification || requestLabel(request);
}

export function filterByDepartment<T extends { department: string }>(
  rows: T[],
  department: string,
) {
  return department === "all"
    ? rows
    : rows.filter((row) => row.department === department);
}

export function priorityForEquipment(priority: PriorityItem[]) {
  return new Map(priority.map((item) => [item.equipment_id, item]));
}

export function availableFrom(data: DashboardData, ...sources: Source[]) {
  return sources.every((source) => !data.failed.includes(source));
}
