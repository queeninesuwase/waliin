import {
  ROUTES,
  equipmentRequestStatus,
  faultTitle,
  myEquipmentRequests,
  requestItemName,
  statusOf,
  type EquipmentRequest,
  type Fault,
  type Notice,
} from "./waliin";

export type ClinicalSources = {
  notices: Notice[];
  faults: Fault[];
  requests: EquipmentRequest[];
};

export type ClinicalSource = keyof ClinicalSources;

export type ClinicalLoad = {
  sources: ClinicalSources;
  failed: ClinicalSource[];
  known: ClinicalSource[];
};

export type ClinicalItem = {
  id: string;
  kind: "notice" | "fault" | "request";
  title: string;
  text: string;
  at: string;
  unread: boolean;
  href: string;
};

export const CLINICAL_SOURCE_LABEL: Record<ClinicalSource, string> = {
  notices: "messages",
  faults: "fault report updates",
  requests: "equipment request updates",
};

const FAULT_TITLE: Record<string, string> = {
  "In repair": "The engineer is working on it",
  "Waiting for part": "Waiting for a spare part",
  "Back in use": "Machine is back in use",
  Closed: "Fault report closed",
};

export function seenKey(userId: string) {
  return `waliin-clinical-seen-${userId}`;
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

export async function loadClinicalSources(
  loaders: { [K in ClinicalSource]: () => Promise<ClinicalSources[K]> },
  previous: ClinicalLoad | null,
): Promise<ClinicalLoad> {
  const failed: ClinicalSource[] = [];
  const known: ClinicalSource[] = [];

  async function pick<K extends ClinicalSource>(
    key: K,
  ): Promise<ClinicalSources[K]> {
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
      return [] as unknown as ClinicalSources[K];
    }
  }

  const [notices, faults, requests] = await Promise.all([
    pick("notices"),
    pick("faults"),
    pick("requests"),
  ]);
  return { sources: { notices, faults, requests }, failed, known };
}

function humanize(value: string) {
  const text = value.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildClinicalItems(
  load: ClinicalLoad,
  userId: string,
  seen: Set<string>,
): ClinicalItem[] {
  const { notices, faults, requests } = load.sources;
  const items: ClinicalItem[] = notices.map((notice) => ({
    id: `notice-${notice.notification_id}`,
    kind: "notice",
    title: humanize(notice.notification_type),
    text: notice.message,
    at: notice.created_at,
    unread: notice.read_at === null,
    href: ROUTES.home,
  }));

  for (const fault of faults) {
    if (fault.reported_by !== userId) continue;
    const label = statusOf(fault);
    if (label === "Received") continue;
    const id = `fault-${fault.fault_id}-${label}`;
    items.push({
      id,
      kind: "fault",
      title: FAULT_TITLE[label],
      text: faultTitle(fault),
      at: fault.closed_at ?? fault.updated_at,
      unread: !seen.has(id),
      href: ROUTES.request(fault.fault_id),
    });
  }

  for (const request of myEquipmentRequests(requests, userId)) {
    const label = equipmentRequestStatus(request);
    if (label === "Submitted") continue;
    const id = `request-${request.request_id}-${label}`;
    const reason = request.decision_reason ? ` ${request.decision_reason}` : "";
    items.push({
      id,
      kind: "request",
      title: `Equipment request: ${label}`,
      text: `${requestItemName(request)}.${reason}`,
      at:
        request.resolved_at ?? request.decided_at ?? request.requested_at ?? "",
      unread: !seen.has(id),
      href: ROUTES.equipmentRequests,
    });
  }

  return items.sort(
    (a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0),
  );
}

export async function markClinicalRead(
  targets: ClinicalItem[],
  userId: string,
  markNotice: (id: string) => Promise<unknown>,
) {
  const local = targets.filter((item) => item.kind !== "notice");
  const notices = targets.filter((item) => item.kind === "notice");
  const failed: ClinicalItem[] = [];

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

export function unreadCount(items: ClinicalItem[]) {
  return items.filter((item) => item.unread).length;
}
