import { apiFetch } from "./client";
import {
  CLOSED_STATUSES,
  type FaultRecord,
  type PriorityListItem,
} from "./faults";
import {
  hasRequirements,
  requestTitle,
  requestTypeLabel,
  type EngineerRequest,
} from "./requests";

export type EngineerNotice = {
  notification_id: string;
  notification_type: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

export type BellSources = {
  notices: EngineerNotice[];
  faults: FaultRecord[];
  priority: PriorityListItem[];
  requests: EngineerRequest[];
};

export type BellSource = keyof BellSources;

export type BellLoad = {
  sources: BellSources;
  failed: BellSource[];
  known: BellSource[];
};

export type BellItem = {
  id: string;
  kind: "notice" | "fault" | "decision" | "ward";
  title: string;
  text: string;
  at: string;
  unread: boolean;
  href: string;
};

export const BELL_SOURCE_LABEL: Record<BellSource, string> = {
  notices: "notifications",
  faults: "fault reports",
  priority: "priority list",
  requests: "requests",
};

const DECISION_TITLE: Record<string, string> = {
  approved: "Request approved",
  in_progress: "Request sent to donors",
  resolved: "Request received",
  rejected: "Request declined",
  returned: "Request returned for changes",
};

const NOTICE_TITLE: Record<string, string> = {
  registration_decided: "Registration decided",
  fault_reported: "Fault reported",
  fault_assigned: "Fault assigned to you",
};

export function listMyNotices() {
  return apiFetch<EngineerNotice[]>("/notifications/me");
}

export function markNoticeRead(notificationId: string) {
  return apiFetch<EngineerNotice>(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "POST" },
  );
}

export function seenKey(userId: string) {
  return `waliin-engineer-seen-${userId}`;
}

export function readSeen(userId: string) {
  try {
    const raw = window.localStorage.getItem(seenKey(userId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(list)
        ? list.filter((item): item is string => typeof item === "string")
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

export function saveSeen(userId: string, seen: Set<string>) {
  try {
    window.localStorage.setItem(
      seenKey(userId),
      JSON.stringify([...seen].slice(-500)),
    );
  } catch {
    return false;
  }
  return true;
}

export async function loadBellSources(
  loaders: { [K in BellSource]: () => Promise<BellSources[K]> },
  previous: BellLoad | null,
): Promise<BellLoad> {
  const failed: BellSource[] = [];
  const known: BellSource[] = [];

  async function pick<K extends BellSource>(key: K): Promise<BellSources[K]> {
    try {
      const value = await loaders[key]();
      known.push(key);
      return value;
    } catch {
      failed.push(key);
      if (previous?.known.includes(key)) {
        known.push(key);
        return previous.sources[key];
      }
      return [] as unknown as BellSources[K];
    }
  }

  const [notices, faults, priority, requests] = await Promise.all([
    pick("notices"),
    pick("faults"),
    pick("priority"),
    pick("requests"),
  ]);
  return { sources: { notices, faults, priority, requests }, failed, known };
}

function humanize(value: string) {
  const text = value.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildBellItems(
  load: BellLoad,
  engineerId: string,
  seen: Set<string>,
): BellItem[] {
  const { notices, faults, priority, requests } = load.sources;
  const items: BellItem[] = notices.map((notice) => ({
    id: `notice-${notice.notification_id}`,
    kind: "notice",
    title:
      NOTICE_TITLE[notice.notification_type] ??
      humanize(notice.notification_type),
    text: notice.message,
    at: notice.created_at,
    unread: notice.read_at === null,
    href: "/biomedical-engineer/equipment/list",
  }));

  if (load.known.includes("faults") && load.known.includes("priority")) {
    const assessed = new Set(priority.map((item) => item.fault_id));
    for (const fault of faults) {
      if (CLOSED_STATUSES.has(fault.status) || assessed.has(fault.fault_id))
        continue;
      const id = `fault-${fault.fault_id}`;
      items.push({
        id,
        kind: "fault",
        title: "New fault report",
        text: `${fault.description.split("\n")[0]}. Waiting for your assessment.`,
        at: fault.reported_at,
        unread: !seen.has(id),
        href: `/biomedical-engineer/faults/${encodeURIComponent(fault.fault_id)}`,
      });
    }
  }

  for (const request of requests) {
    const status = (request.status ?? "pending").toLowerCase();
    if (request.requested_by === engineerId && DECISION_TITLE[status]) {
      const id = `decision-${request.request_id}-${status}`;
      const reason = request.decision_reason
        ? ` ${request.decision_reason}`
        : "";
      items.push({
        id,
        kind: "decision",
        title: DECISION_TITLE[status],
        text: `${requestTypeLabel(request.request_type)}: ${requestTitle(request)}.${reason}`,
        at: request.decided_at ?? request.requested_at ?? "",
        unread: !seen.has(id),
        href: "/biomedical-engineer/requests",
      });
    }
    if (
      request.request_type === "new_equipment" &&
      request.requested_by !== engineerId &&
      ["pending", "returned"].includes(status) &&
      !hasRequirements(request.justification)
    ) {
      const id = `ward-${request.request_id}`;
      items.push({
        id,
        kind: "ward",
        title: "Ward needs equipment",
        text: `${requestTitle(request)}${
          request.requester_name ? ` from ${request.requester_name}` : ""
        }. Add the technical requirements.`,
        at: request.requested_at ?? "",
        unread: !seen.has(id),
        href: "/biomedical-engineer/requests",
      });
    }
  }

  return items.sort(
    (a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0),
  );
}

export async function markItemsRead(
  targets: BellItem[],
  userId: string,
  markNotice: (id: string) => Promise<unknown> = markNoticeRead,
) {
  const local = targets.filter((item) => item.kind !== "notice");
  const notices = targets.filter((item) => item.kind === "notice");
  const failed: BellItem[] = [];

  if (local.length > 0) {
    const seen = readSeen(userId);
    local.forEach((item) => seen.add(item.id));
    if (!saveSeen(userId, seen)) failed.push(...local);
  }

  const results = await Promise.allSettled(
    notices.map((item) => markNotice(item.id.replace("notice-", ""))),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected") failed.push(notices[index]);
  });

  return failed;
}

export function readFailureMessage(count: number) {
  return count === 1
    ? "Could not mark 1 notification as read."
    : `Could not mark ${count} notifications as read.`;
}

export function unreadCount(items: BellItem[]) {
  return items.filter((item) => item.unread).length;
}

export function timeAgo(iso: string, now: number) {
  const time = Date.parse(iso);
  if (Number.isNaN(time) || !now) return "";
  const minutes = Math.max(0, Math.round((now - time) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
