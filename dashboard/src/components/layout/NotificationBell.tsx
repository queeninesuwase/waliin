"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { BellIcon } from "@/components/layout/navIcons";
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
  unreadCount,
  type BellItem,
  type BellLoad,
} from "@/features/notifications/api";
import { getRequests } from "@/features/requests/api";

const REFRESH_MS = 60_000;

const KIND_STYLE: Record<BellItem["kind"], string> = {
  notice: "bg-rose/40 text-brand",
  registration: "bg-amber-50 text-amber-700",
  request: "bg-emerald-50 text-emerald-700",
};

const KIND_LETTER: Record<BellItem["kind"], string> = {
  notice: "N",
  registration: "E",
  request: "R",
};

const LOADERS = {
  notices: listMyNotifications,
  pending: listPendingEquipment,
  requests: getRequests,
};

export default function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<BellItem[]>([]);
  const [load, setLoad] = useState<BellLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<BellLoad | null>(null);

  useEffect(() => {
    let active = true;
    loadBellSources(LOADERS, last.current).then((result) => {
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
  }, [userId, tick]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setTick((count) => count + 1),
      REFRESH_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = unreadCount(items);
  const failed = load?.failed ?? [];
  const nothingKnown = !load || load.known.length === 0;
  const kept = failed.some((source) => load?.known.includes(source));

  function retry() {
    setLoading(true);
    setTick((value) => value + 1);
  }

  function markSeen(targets: BellItem[]) {
    const seen = readSeen(userId);
    for (const item of targets) {
      if (item.kind === "notice") {
        markNotificationRead(item.id.replace("notice-", "")).catch(() => {});
      } else {
        seen.add(item.id);
      }
    }
    saveSeen(userId, seen);
    const ids = new Set(targets.map((item) => item.id));
    setItems((list) =>
      list.map((item) =>
        ids.has(item.id) ? { ...item, unread: false } : item,
      ),
    );
  }

  function toggle() {
    if (!open) setTick((value) => value + 1);
    setOpen((value) => !value);
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-brand hover:bg-gray-100"
      >
        <BellIcon className="h-6 w-6" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
        {count === 0 && failed.length > 0 && nothingKnown && (
          <span
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white ring-2 ring-white"
            aria-hidden="true"
          >
            !
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-rose bg-white shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-rose/60 px-4 py-3">
            <div>
              <p className="text-base font-bold text-brand">Notifications</p>
              <p className="text-sm text-gray-500">
                {loading && !load
                  ? "Loading..."
                  : count
                    ? `${count} unread`
                    : failed.length > 0
                      ? "Some notifications could not be loaded"
                      : "You are all caught up"}
              </p>
            </div>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markSeen(items.filter((item) => item.unread))}
                className="text-sm font-semibold text-brand hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {failed.length > 0 && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-500/10"
            >
              <span>
                Could not load{" "}
                {failed.map((source) => BELL_SOURCE_LABEL[source]).join(", ")}.
                {kept ? " Showing the last loaded items." : ""}
              </span>
              <button
                type="button"
                onClick={retry}
                disabled={loading}
                className="shrink-0 font-semibold underline disabled:opacity-60"
              >
                {loading ? "Retrying..." : "Retry"}
              </button>
            </div>
          )}

          {loading && !load ? (
            <div
              role="status"
              className="flex flex-col gap-2 px-4 py-6"
              aria-label="Loading notifications"
            >
              {[0, 1, 2].map((row) => (
                <span
                  key={row}
                  className="h-12 animate-pulse rounded-lg bg-gray-100"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500">
              {failed.length > 0
                ? "Nothing to show until the notifications load."
                : "No notifications yet."}
            </p>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-rose/40 overflow-y-auto">
              {items.slice(0, 30).map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      markSeen([item]);
                      setOpen(false);
                    }}
                    className={`flex gap-3 px-4 py-3 transition hover:bg-cream ${
                      item.unread ? "bg-rose/10" : ""
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${KIND_STYLE[item.kind]}`}
                      aria-hidden="true"
                    >
                      {KIND_LETTER[item.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-sm ${
                            item.unread
                              ? "font-bold text-gray-900"
                              : "font-medium text-gray-700"
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="shrink-0 text-xs text-gray-400">
                          {timeAgo(item.at, now)}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-sm text-gray-500">
                        {item.text}
                      </span>
                    </span>
                    {item.unread && (
                      <span
                        className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-600"
                        aria-label="Unread"
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
