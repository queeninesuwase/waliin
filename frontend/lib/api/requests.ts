import { apiFetch } from "./client";

export type RequestItem = {
  item_id?: string;
  item_name?: string | null;
  item_name_or_service?: string | null;
  specification?: string | null;
  technical_specifications?: string | null;
  quantity_requested: number;
};

export type EngineerRequest = {
  request_id: string;
  request_number?: string;
  requested_by: string;
  requester_name?: string;
  related_fault_id: string | null;
  request_type: string;
  justification: string;
  status: string | null;
  decision_reason: string | null;
  requested_at: string | null;
  decided_at: string | null;
  resolved_at: string | null;
  items?: RequestItem[] | null;
};

export type Requirements = {
  power: string;
  parts: string;
  service: string;
  training: string;
};

export const REQUIREMENTS_HEADING = "Technical requirements (engineer):";

export const RESUBMITTED_NOTE = "Resubmitted after changes on";

const REQUIREMENT_LABELS: [keyof Requirements, string][] = [
  ["power", "Power and voltage"],
  ["parts", "Spare parts and accessories"],
  ["service", "Service support and manuals"],
  ["training", "Training"],
];

export const DEFAULT_REQUIREMENTS: Requirements = {
  power: "220 V, 50 Hz",
  parts: "",
  service: "",
  training: "",
};

export const REQUEST_TYPE_LABEL: Record<string, string> = {
  spare_parts: "Spare parts",
  technical_support: "Outside help",
  replacement_resource: "Replacement machine",
  new_equipment: "New equipment",
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for manager",
  approved: "Approved",
  in_progress: "Sent to donors",
  resolved: "Received",
  rejected: "Declined",
  returned: "Returned for changes",
};

export function getAllRequests() {
  return apiFetch<EngineerRequest[]>("/requests");
}

export function updateJustification(requestId: string, justification: string) {
  return apiFetch<EngineerRequest>(
    `/requests/${encodeURIComponent(requestId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ justification }),
    },
  );
}

export function isResubmitted(request: EngineerRequest) {
  return (
    (request.status ?? "").toLowerCase() === "returned" &&
    request.justification.includes(RESUBMITTED_NOTE)
  );
}

export function requestStatus(request: EngineerRequest) {
  if (isResubmitted(request)) return "Resubmitted, waiting for manager";
  const key = (request.status ?? "pending").toLowerCase();
  return REQUEST_STATUS_LABEL[key] ?? key.replace(/_/g, " ");
}

export function canEdit(request: EngineerRequest) {
  return ["pending", "returned"].includes(
    (request.status ?? "pending").toLowerCase(),
  );
}

export function requestTypeLabel(type: string) {
  return REQUEST_TYPE_LABEL[type] ?? type.replace(/_/g, " ");
}

export function requestItemName(request: EngineerRequest) {
  const item = request.items?.[0];
  return (
    item?.item_name ||
    item?.item_name_or_service ||
    requestTypeLabel(request.request_type)
  );
}

export function requestQuantity(request: EngineerRequest) {
  return (request.items ?? []).reduce(
    (sum, item) => sum + (item.quantity_requested ?? 0),
    0,
  );
}

export function requestTitle(request: EngineerRequest) {
  const items = request.items ?? [];
  const name = requestItemName(request);
  if (items.length > 1) {
    const more = items.length - 1;
    return `${name} and ${more} more ${more === 1 ? "item" : "items"}`;
  }
  const quantity = requestQuantity(request);
  return quantity > 1 ? `${name} × ${quantity}` : name;
}

export function hasRequirements(justification: string) {
  return justification.includes(REQUIREMENTS_HEADING);
}

function withoutResubmittedNote(text: string) {
  return text
    .split("\n")
    .filter((line) => !line.startsWith(RESUBMITTED_NOTE))
    .join("\n");
}

export function splitJustification(justification: string) {
  const text = withoutResubmittedNote(justification);
  const index = text.indexOf(REQUIREMENTS_HEADING);
  if (index === -1) return { reason: text.trim(), requirements: "" };
  return {
    reason: text.slice(0, index).trim(),
    requirements: text.slice(index + REQUIREMENTS_HEADING.length).trim(),
  };
}

export function parseRequirements(justification: string): Requirements {
  const { requirements } = splitJustification(justification);
  const values = { ...DEFAULT_REQUIREMENTS };
  if (!requirements) return values;
  for (const line of requirements.split("\n")) {
    for (const [key, label] of REQUIREMENT_LABELS) {
      const prefix = `- ${label}:`;
      if (line.startsWith(prefix))
        values[key] = line.slice(prefix.length).trim();
    }
  }
  return values;
}

export function markResubmitted(justification: string, when: Date) {
  const date = when.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${withoutResubmittedNote(justification).trim()}\n\n${RESUBMITTED_NOTE} ${date}.`;
}

export type EditableItem = {
  name: string;
  quantity: number;
  specification: string;
};

function itemName(item: RequestItem) {
  return (item.item_name || item.item_name_or_service || "").trim();
}

export function editableItems(request: EngineerRequest): EditableItem[] {
  return (request.items ?? []).map((item) => ({
    name: itemName(item),
    quantity: item.quantity_requested,
    specification: item.specification ?? item.technical_specifications ?? "",
  }));
}

export function editProblem(request: EngineerRequest) {
  const names = (request.items ?? []).map(itemName);
  if (names.length === 0) {
    return "This request has no items to edit. Send a new request instead.";
  }
  if (names.some((name) => !name)) {
    return "One item in this request has no name, so it cannot be edited here. Send a new request instead.";
  }
  const unique = new Set(names.map((name) => name.toLowerCase()));
  if (unique.size !== names.length) {
    return "Two items in this request have the same name, so they cannot be edited separately here. Send a new request instead.";
  }
  return null;
}

export function checkRequirements(input: Requirements) {
  if (!input.power.trim()) return "Add the power and voltage needed.";
  if (!input.parts.trim()) return "List the spare parts and accessories.";
  if (!input.service.trim())
    return "Say what service support and manuals are needed.";
  if (!input.training.trim())
    return "Say what training users and engineers need.";
  return null;
}

export function withRequirements(justification: string, input: Requirements) {
  const { reason } = splitJustification(justification);
  return [
    reason,
    "",
    REQUIREMENTS_HEADING,
    ...REQUIREMENT_LABELS.map(
      ([key, label]) => `- ${label}: ${input[key].trim()}`,
    ),
  ].join("\n");
}

export type RequestEdit = {
  request_type: string;
  justification: string;
  items: EditableItem[];
};

export function updateRequest(requestId: string, edit: RequestEdit) {
  return apiFetch<EngineerRequest>(
    `/requests/${encodeURIComponent(requestId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        request_type: edit.request_type,
        justification: edit.justification,
        items: edit.items.map((item) => ({
          item_name_or_service: item.name,
          technical_specifications: item.specification.trim() || null,
          quantity_requested: item.quantity,
        })),
      }),
    },
  );
}

export function sortNewest(requests: EngineerRequest[]) {
  return [...requests].sort(
    (a, b) =>
      (Date.parse(b.requested_at ?? "") || 0) -
      (Date.parse(a.requested_at ?? "") || 0),
  );
}
