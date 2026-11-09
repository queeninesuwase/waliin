"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  BELL_SOURCE_LABEL,
  buildBellItems,
  listMyNotices,
  loadBellSources,
  markItemsRead,
  readFailureMessage,
  readSeen,
  timeAgo,
  unreadCount,
  type BellItem,
  type BellLoad,
} from "@/lib/api/engineerNotifications";
import { getAllFaults, getPriorityList } from "@/lib/api/faults";
import { getAllRequests } from "@/lib/api/requests";

const REFRESH_MS = 60_000;

const LOADERS = {
  notices: listMyNotices,
  faults: getAllFaults,
  priority: getPriorityList,
  requests: getAllRequests,
};

const KIND_STYLE: Record<BellItem["kind"], string> = {
  notice: "bg-[#e8b4c0]/40 text-[#650d2f]",
  fault: "bg-red-50 text-red-700",
  decision: "bg-emerald-50 text-emerald-700",
  ward: "bg-amber-50 text-amber-700",
};

const KIND_LETTER: Record<BellItem["kind"], string> = {
  notice: "N",
  fault: "F",
  decision: "R",
  ward: "W",
};

export default function EngineerBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<BellItem[]>([]);
  const [load, setLoad] = useState<BellLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(0);
  const [readFailed, setReadFailed] = useState<BellItem[]>([]);
  const [marking, setMarking] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<BellLoad | null>(null);

  useEffect(() => {
    let active = true;
    loadBellSources(LOADERS, last.current).then((result) => {
      if (!active) return;
      last.current = result;
      setLoad(result);
      const fresh = buildBellItems(result, userId, readSeen(userId));
      setItems(fresh);
      setReadFailed((failed) =>
        failed.filter((item) =>
          fresh.some((next) => next.id === item.id && next.unread),
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
  const faultsHidden =
    !!load &&
    (!load.known.includes("faults") || !load.known.includes("priority"));

  async function markSeen(targets: BellItem[]) {
    if (targets.length === 0) return;
    const ids = new Set(targets.map((item) => item.id));
    setItems((list) =>
      list.map((item) =>
        ids.has(item.id) ? { ...item, unread: false } : item,
      ),
    );
    setMarking(true);
    const failed = await markItemsRead(targets, userId);
    setMarking(false);
    setReadFailed(failed);
    if (failed.length === 0) return;
    const failedIds = new Set(failed.map((item) => item.id));
    setItems((list) =>
      list.map((item) =>
        failedIds.has(item.id) ? { ...item, unread: true } : item,
      ),
    );
  }

  function retry() {
    setLoading(true);
    setTick((value) => value + 1);
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
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#650d2f] hover:bg-gray-100"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
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
        <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#e8b4c0] bg-white shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-[#e8b4c0]/60 px-4 py-3">
            <div>
              <p className="text-base font-bold text-[#650d2f]">
                Notifications
              </p>
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
                disabled={marking}
                className="text-sm font-semibold text-[#650d2f] hover:underline disabled:opacity-60"
              >
                Mark all as read
              </button>
            )}
          </div>

          {failed.length > 0 && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <span>
                Could not load{" "}
                {failed.map((source) => BELL_SOURCE_LABEL[source]).join(", ")}.
                {kept ? " Showing the last loaded items." : ""}
                {faultsHidden ? " New fault reports cannot be shown." : ""}
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

          {readFailed.length > 0 && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              <span>
                {readFailureMessage(readFailed.length)} They are still shown as
                unread.
              </span>
              <button
                type="button"
                onClick={() => markSeen(readFailed)}
                disabled={marking}
                className="shrink-0 font-semibold underline disabled:opacity-60"
              >
                {marking ? "Retrying..." : "Retry"}
              </button>
            </div>
          )}

          {loading && !load ? (
            <div
              role="status"
              aria-label="Loading notifications"
              className="flex flex-col gap-2 px-4 py-6"
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
            <ul className="max-h-[26rem] divide-y divide-[#e8b4c0]/40 overflow-y-auto">
              {items.slice(0, 30).map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      markSeen([item]);
                      setOpen(false);
                    }}
                    className={`flex gap-3 px-4 py-3 transition hover:bg-[#fbfaf7] ${
                      item.unread ? "bg-[#e8b4c0]/10" : ""
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
