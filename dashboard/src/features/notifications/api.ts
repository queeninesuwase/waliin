import type { Equipment } from "@/features/equipment/api";
import type { ResourceRequest } from "@/features/requests/api";
import { apiFetch } from "@/lib/api/client";

export type AppNotification = {
  notification_id: string;
  notification_type: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

export type BellItem = {
  id: string;
  kind: "notice" | "registration" | "request";
  title: string;
  text: string;
  at: string;
  unread: boolean;
  href: string;
};

const REQUEST_LABEL: Record<string, string> = {
  spare_parts: "Spare parts request",
  technical_support: "Outside help request",
  replacement_resource: "Replacement request",
  new_equipment: "New equipment request",
};

export function listMyNotifications() {
  return apiFetch<AppNotification[]>("/notifications/me");
}

export function markNotificationRead(notificationId: string) {
  return apiFetch<AppNotification>(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "POST" },
  );
}

export function seenKey(userId: string) {
  return `waliin-seen-${userId}`;
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

function humanize(value: string) {
  const text = value.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildBellItems(
  notices: AppNotification[],
  pendingEquipment: Equipment[],
  requests: ResourceRequest[],
  seen: Set<string>,
): BellItem[] {
  const items: BellItem[] = [
    ...notices.map((notice) => ({
      id: `notice-${notice.notification_id}`,
      kind: "notice" as const,
      title: humanize(notice.notification_type),
      text: notice.message,
      at: notice.created_at,
      unread: notice.read_at === null,
      href: "/notifications",
    })),
    ...pendingEquipment.map((item) => ({
      id: `registration-${item.equipment_id}`,
      kind: "registration" as const,
      title: "New equipment registration",
      text: `${item.model_name} (${item.asset_tag}) is waiting for your approval.`,
      at: item.created_at,
      unread: !seen.has(`registration-${item.equipment_id}`),
      href: "/equipment",
    })),
    ...requests
      .filter((request) => (request.status ?? "pending") === "pending")
      .map((request) => {
        const item = request.items?.[0];
        const what = item?.item_name ? `: ${item.item_name}` : "";
        const who = request.requester_name
          ? ` from ${request.requester_name}`
          : "";
        return {
          id: `request-${request.request_id}`,
          kind: "request" as const,
          title: REQUEST_LABEL[request.request_type] ?? "New request",
          text: `New request${who}${what}. Waiting for your decision.`,
          at: request.requested_at ?? "",
          unread: !seen.has(`request-${request.request_id}`),
          href: `/requests/${encodeURIComponent(request.request_id)}`,
        };
      }),
  ];
  return items.sort(
    (a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0),
  );
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

export type BellSources = {
  notices: AppNotification[];
  pending: Equipment[];
  requests: ResourceRequest[];
};

export type BellSource = keyof BellSources;

export type BellLoad = {
  sources: BellSources;
  failed: BellSource[];
  known: BellSource[];
};

export const BELL_SOURCE_LABEL: Record<BellSource, string> = {
  notices: "notifications",
  pending: "new registrations",
  requests: "requests",
};

export async function loadBellSources(
  loaders: {
    [K in BellSource]: () => Promise<BellSources[K]>;
  },
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

  const [notices, pending, requests] = await Promise.all([
    pick("notices"),
    pick("pending"),
    pick("requests"),
  ]);
  return { sources: { notices, pending, requests }, failed, known };
}
