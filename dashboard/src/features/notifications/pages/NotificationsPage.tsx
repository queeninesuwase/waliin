"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { listPendingEquipment } from "@/features/equipment/api";
import {
  BELL_SOURCE_LABEL,
  buildBellItems,
  listMyNotifications,
  loadBellSources,
  markNotificationRead,
  readSeen,
  saveSeen,
  timeAgo,
  type BellItem,
  type BellLoad,
} from "@/features/notifications/api";
import { getRequests } from "@/features/requests/api";

export default function NotificationsPage() {
  const { user } = useCurrentUser();
  const userId = user?.user_id ?? "";
  const [items, setItems] = useState<BellItem[] | null>(null);
  const [load, setLoad] = useState<BellLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(0);
  const last = useRef<BellLoad | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadBellSources(
      {
        notices: listMyNotifications,
        pending: listPendingEquipment,
        requests: getRequests,
      },
      last.current,
    ).then((result) => {
      if (!active) return;
      last.current = result;
      setLoad(result);
      setItems(
        buildBellItems(
          result.sources.notices,
          result.sources.pending,
          result.sources.requests,
          readSeen(userId),
        ),
      );
      setNow(Date.now());
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const failed = load?.failed ?? [];

  function retry() {
    setLoading(true);
    setAttempt((count) => count + 1);
  }

  function markAll() {
    if (!items) return;
    const seen = readSeen(userId);
    for (const item of items) {
      if (!item.unread) continue;
      if (item.kind === "notice") {
        markNotificationRead(item.id.replace("notice-", "")).catch(() => {});
      } else {
        seen.add(item.id);
      }
    }
    saveSeen(userId, seen);
    setItems(items.map((item) => ({ ...item, unread: false })));
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-brand">Notifications</h1>
          <p className="mt-2 text-base text-gray-500">
            New registrations, requests and updates from engineers.
          </p>
        </div>
        {items?.some((item) => item.unread) && (
          <button
            type="button"
            onClick={markAll}
            className="rounded-lg border border-brand px-4 py-2 text-base font-semibold text-brand hover:bg-brand hover:text-white"
          >
            Mark all as read
          </button>
        )}
      </div>

      {failed.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800 dark:bg-red-500/10"
        >
          <span>
            Could not load{" "}
            {failed.map((source) => BELL_SOURCE_LABEL[source]).join(", ")}.
            {failed.some((source) => load?.known.includes(source))
              ? " Showing the last loaded items."
              : ""}
          </span>
          <button
            type="button"
            onClick={retry}
            disabled={loading}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            {loading ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-rose bg-white">
        {items === null ? (
          <p role="status" className="px-6 py-10 text-base text-gray-500">
            Loading notifications...
          </p>
        ) : items.length === 0 ? (
          <p className="px-6 py-10 text-base text-gray-500">
            {failed.length > 0
              ? "Nothing to show until the notifications load."
              : "No notifications yet."}
          </p>
        ) : (
          <ul className="divide-y divide-rose/40">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`flex items-start gap-4 px-6 py-4 hover:bg-cream ${
                    item.unread ? "bg-rose/10" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-base ${
                        item.unread
                          ? "font-bold text-gray-900"
                          : "font-medium text-gray-700"
                      }`}
                    >
                      {item.title}
                    </span>
                    <span className="mt-1 block text-base text-gray-500">
                      {item.text}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-gray-400">
                    {timeAgo(item.at, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
