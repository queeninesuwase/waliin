import { hasRequirements } from "./api/requests";

const API = "/api";

export const ROUTES = {
  home: "/home",
  requests: "/requests",
  newRequest: "/requests/new",
  equipmentRequests: "/equipment-requests",
  newEquipmentRequest: "/equipment-requests/new",
  request: (id: string) => `/requests/${id}`,
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const FRIENDLY_ERROR: Record<number, string> = {
  0: "Cannot reach the server. Check your connection.",
  401: "Your session has ended. Sign in again.",
  403: "You do not have access to this. Sign in again if this keeps happening.",
  404: "This could not be found.",
  500: "The server had a problem. Try again in a moment.",
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(FRIENDLY_ERROR[0], 0);
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      detail = "";
    }
    const friendly = FRIENDLY_ERROR[res.status >= 500 ? 500 : res.status];
    throw new ApiError(
      friendly ?? (detail || "Something went wrong. Try again."),
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong.";

export type Fault = {
  fault_id: string;
  equipment_id: string;
  reported_by: string;
  assigned_engineer_id: string | null;
  description: string;
  severity: string;
  status: string;
  reported_at: string;
  out_of_service_at?: string | null;
  client_report_id?: string | null;
  updated_at: string;
  closed_at: string | null;
};

export type Equipment = {
  equipment_id: string;
  model_name: string;
  manufacturer?: string;
  equipment_category: string;
  department_id: string;
  asset_tag: string;
  location: string;
  registration_status?: string;
  service_status?: string;
};

export type WorkRecord = {
  record_id: string;
  record_type: string;
  work_performed: string | null;
  test_result: string | null;
  test_details: string | null;
  performed_at: string;
  released_at: string | null;
};

export type Notice = {
  notification_id: string;
  notification_type: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

export type Severity = "low" | "medium" | "high";
export const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: "low", label: "Low – patients are not affected" },
  { value: "medium", label: "Medium – care is slowed down" },
  { value: "high", label: "High – patients cannot get care" },
];
export const severityLabel = (s: string) =>
  SEVERITY_OPTIONS.find((o) => o.value === s)?.label ?? humanize(s);

export const PROBLEM_OPTIONS = [
  "Does not turn on",
  "Shows an error message",
  "Strange noise or smell",
  "Wrong or unstable readings",
  "Broken or loose part",
  "Battery does not charge",
  "Missing accessory",
  "Other",
] as const;
export type Problem = (typeof PROBLEM_OPTIONS)[number];

export type StatusLabel =
  "Received" | "In repair" | "Waiting for part" | "Back in use" | "Closed";
export const STATUS_FILTERS: StatusLabel[] = [
  "Received",
  "In repair",
  "Waiting for part",
  "Back in use",
  "Closed",
];

export function statusOf(f: Pick<Fault, "status">): StatusLabel {
  if (f.status === "closed") return "Back in use";
  if (f.status === "cancelled") return "Closed";
  if (f.status === "reported") return "Received";
  if (f.status === "awaiting_resources") return "Waiting for part";
  return "In repair";
}

export const isOpen = (f: Pick<Fault, "status">) =>
  f.status !== "closed" && f.status !== "cancelled";

export type Usability = "yes" | "limited" | "no";
export const USABILITY_OPTIONS: { value: Usability; label: string }[] = [
  { value: "yes", label: "Yes, it still works" },
  { value: "limited", label: "Partly, with problems" },
  { value: "no", label: "No, it cannot be used" },
];

export function usabilityLabel(value: Usability) {
  return USABILITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function faultDescription(input: {
  problem: Problem;
  note: string;
  usable: Usability;
  impact: string;
}) {
  const note = input.note.trim();
  const title =
    input.problem === "Other"
      ? note
      : note
        ? `${input.problem}: ${note}`
        : input.problem;
  const parts = [
    title,
    `Can it still be used: ${usabilityLabel(input.usable)}.`,
  ];
  if (input.impact.trim()) {
    parts.push(`Effect on patients: ${input.impact.trim()}`);
  }
  return parts.join("\n");
}

export function checkFaultReport(input: {
  equipment_id: string;
  problem: string;
  note: string;
}) {
  if (!input.equipment_id) return "Choose the machine.";
  if (!input.problem) return "Choose what is wrong.";
  if (input.problem === "Other" && !input.note.trim()) {
    return "Describe what is wrong.";
  }
  return null;
}

export const faultTitle = (f: Pick<Fault, "description">) =>
  f.description.split("\n")[0];

export const refOf = (id: string) => `REQ-${id.slice(0, 8).toUpperCase()}`;

export const humanize = (s: string) => {
  const t = s.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function displayName(user: unknown): string {
  const u = user as { full_name?: string | null; name?: string | null };
  return u.full_name ?? u.name ?? "";
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});
const shortFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtShort = (iso: string) => shortFmt.format(new Date(iso));
export const fmtDateTime = (iso: string) =>
  `${fmtDate(iso)}, ${timeFmt.format(new Date(iso))}`;

export const isToday = (iso: string, now = Date.now()) =>
  new Date(iso).toDateString() === new Date(now).toDateString();

export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function outOfServiceFor(since: string, now = Date.now()) {
  const days = Math.floor((now - Date.parse(since)) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days < 1) return "since today";
  return days === 1 ? "for 1 day" : `for ${days} days`;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const FAULTS_FRESH_MS = 20_000;

let faultsCache: { at: number; request: Promise<Fault[]> } | null = null;

export function clearFaultsCache() {
  faultsCache = null;
}

export function fetchFaults(fresh = false): Promise<Fault[]> {
  const now = Date.now();
  if (!fresh && faultsCache && now - faultsCache.at < FAULTS_FRESH_MS) {
    return faultsCache.request;
  }
  const request = call<Fault[]>("/fault-list?limit=1000");
  faultsCache = { at: now, request };
  request.catch(() => {
    if (faultsCache?.request === request) faultsCache = null;
  });
  return request;
}

export async function fetchMyFaults(userId: string, fresh = false) {
  const all = await fetchFaults(fresh);
  return all
    .filter((f) => f.reported_by === userId)
    .sort((a, b) => Date.parse(b.reported_at) - Date.parse(a.reported_at));
}

export const fetchFault = (id: string) =>
  call<Fault>(`/faults/${encodeURIComponent(id)}`);

export async function createFault(body: {
  equipment_id: string;
  reported_by: string;
  description: string;
  severity: Severity;
  client_report_id: string;
}) {
  try {
    const created = await call<Fault>("/faults/", {
      method: "POST",
      body: JSON.stringify({
        ...body,
        failure_observed_at: new Date().toISOString(),
      }),
    });
    clearFaultsCache();
    return created;
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 409)) throw e;
    const mine = await fetchMyFaults(body.reported_by, true);
    const sent = mine.find((f) => f.client_report_id === body.client_report_id);
    if (!sent) throw e;
    return sent;
  }
}

export const fetchWorkRecords = (id: string) =>
  call<WorkRecord[]>(`/faults/${encodeURIComponent(id)}/records`);

const equipmentCache = new Map<string, Equipment>();

export async function fetchEquipmentMap(ids: string[]) {
  const missing = ids.filter((id) => !equipmentCache.has(id));
  const results = await Promise.allSettled(
    missing.map((id) =>
      call<Equipment>(`/equipment/${encodeURIComponent(id)}`),
    ),
  );
  results.forEach((r) => {
    if (r.status === "fulfilled") {
      equipmentCache.set(r.value.equipment_id, r.value);
    }
  });
  return equipmentCache;
}

export const equipmentName = (e?: Equipment | null) =>
  e?.equipment_category || e?.model_name || "Equipment";

export function equipmentLabel(e: Equipment) {
  const model = e.model_name && e.model_name !== e.equipment_category;
  return [e.equipment_category, model ? e.model_name : "", e.asset_tag]
    .filter(Boolean)
    .join(" · ");
}

export function matchesEquipment(e: Equipment, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [e.equipment_category, e.model_name, e.asset_tag, e.location]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(q));
}

export function usableEquipment(
  list: Equipment[],
  departmentId: string | null,
) {
  return list
    .filter(
      (e) =>
        (!e.registration_status || e.registration_status === "approved") &&
        (!departmentId || e.department_id === departmentId),
    )
    .sort((a, b) => equipmentLabel(a).localeCompare(equipmentLabel(b)));
}

export async function fetchEquipmentOptions(
  departmentId: string | null,
): Promise<Equipment[]> {
  const list = await call<Equipment[]>("/equipment");
  list.forEach((e) => equipmentCache.set(e.equipment_id, e));
  return usableEquipment(list, departmentId);
}

export const SERVICE_STATUS: Record<
  string,
  { label: string; tone: "ok" | "down" | "work" | "idle" }
> = {
  in_service: { label: "In service", tone: "ok" },
  out_of_service: { label: "Out of service", tone: "down" },
  under_maintenance: { label: "Under maintenance", tone: "work" },
  not_assessed: { label: "Not checked yet", tone: "idle" },
  not_installed: { label: "Not installed", tone: "idle" },
  incomplete: { label: "Incomplete", tone: "idle" },
  retired: { label: "Retired", tone: "idle" },
};

export function serviceStatus(e: Pick<Equipment, "service_status">) {
  return (
    SERVICE_STATUS[e.service_status ?? "not_assessed"] ?? {
      label: humanize(e.service_status ?? "unknown"),
      tone: "idle" as const,
    }
  );
}

const TONE_ORDER = { down: 0, work: 1, idle: 2, ok: 3 };

export function wardMachines(list: Equipment[]) {
  return list
    .filter((e) => e.service_status !== "retired")
    .sort(
      (a, b) =>
        TONE_ORDER[serviceStatus(a).tone] - TONE_ORDER[serviceStatus(b).tone] ||
        equipmentLabel(a).localeCompare(equipmentLabel(b)),
    );
}

export function newReportFor(equipmentId: string) {
  return `${ROUTES.newRequest}?equipment=${encodeURIComponent(equipmentId)}`;
}

export type EquipmentRequest = {
  request_id: string;
  request_number?: string;
  requested_by: string;
  request_type: string;
  justification: string;
  status: string | null;
  decision_reason: string | null;
  requested_at: string | null;
  decided_at: string | null;
  resolved_at: string | null;
  items?: {
    item_id: string;
    item_name?: string | null;
    item_name_or_service?: string | null;
    quantity_requested: number;
  }[];
};

export type Urgency = "routine" | "soon" | "urgent";
export const URGENCY_OPTIONS: { value: Urgency; label: string }[] = [
  { value: "routine", label: "Routine – plan for it" },
  { value: "soon", label: "Soon – care is slowed down" },
  { value: "urgent", label: "Urgent – patients are referred or waiting" },
];

export function requestJustification(input: {
  reason: string;
  patients: number;
  urgency: Urgency;
}) {
  const urgency =
    URGENCY_OPTIONS.find((o) => o.value === input.urgency)?.label ??
    input.urgency;
  return [
    input.reason.trim(),
    `Patients it would serve each week: ${input.patients}.`,
    `Urgency: ${urgency}.`,
  ].join("\n");
}

export function checkEquipmentRequest(input: {
  item: string;
  quantity: number;
  reason: string;
  patients: number;
}) {
  if (!input.item.trim()) return "Say which equipment your department needs.";
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    return "Quantity must be at least 1.";
  }
  if (!input.reason.trim()) return "Explain why your department needs it.";
  if (!Number.isInteger(input.patients) || input.patients < 0) {
    return "Enter how many patients it would serve each week.";
  }
  return null;
}

export const EQUIPMENT_REQUEST_STATUS: Record<string, string> = {
  pending: "Submitted",
  reviewed: "Under review",
  returned: "More detail needed",
  approved: "Approved",
  in_progress: "Sent to donors",
  resolved: "Received",
  rejected: "Declined",
};

export function equipmentRequestStatus(
  r: Pick<EquipmentRequest, "status" | "justification">,
) {
  const key = (r.status ?? "pending").toLowerCase();
  if (key === "pending" && hasRequirements(r.justification ?? "")) {
    return EQUIPMENT_REQUEST_STATUS.reviewed;
  }
  return EQUIPMENT_REQUEST_STATUS[key] ?? humanize(key);
}

export const requestRef = (
  r: Pick<EquipmentRequest, "request_id" | "request_number">,
) => r.request_number ?? `REQ-${r.request_id.slice(0, 8).toUpperCase()}`;

export const requestItemName = (r: EquipmentRequest) => {
  const item = r.items?.[0];
  return item?.item_name || item?.item_name_or_service || "Equipment";
};

export const createEquipmentRequest = (
  userId: string,
  input: { item: string; quantity: number; justification: string },
) =>
  call<EquipmentRequest>("/requests", {
    method: "POST",
    headers: { "user-id": userId },
    body: JSON.stringify({
      request_type: "new_equipment",
      justification: input.justification,
      items: [
        {
          item_name_or_service: input.item.trim(),
          technical_specifications: null,
          quantity_requested: input.quantity,
        },
      ],
    }),
  });

export const fetchAllRequests = () => call<EquipmentRequest[]>("/requests");

export function myEquipmentRequests(all: EquipmentRequest[], userId: string) {
  return all
    .filter(
      (r) => r.requested_by === userId && r.request_type === "new_equipment",
    )
    .sort(
      (a, b) =>
        (Date.parse(b.requested_at ?? "") || 0) -
        (Date.parse(a.requested_at ?? "") || 0),
    );
}

export async function fetchMyEquipmentRequests(userId: string) {
  return myEquipmentRequests(await fetchAllRequests(), userId);
}

export const fetchNotifications = () => call<Notice[]>("/notifications/me");

export const markNoticeRead = (id: string) =>
  call<Notice>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
