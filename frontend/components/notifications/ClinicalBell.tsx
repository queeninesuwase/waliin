"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useClinicalNotices } from "@/components/notifications/ClinicalNotices";
import { Icon } from "@/components/waliin/ui";
import {
  CLINICAL_SOURCE_LABEL,
  readFailureMessage,
  type ClinicalItem,
} from "@/lib/clinicalNotifications";
import { fmtShort, isToday, timeAgo } from "@/lib/waliin";

const KIND_STYLE: Record<ClinicalItem["kind"], string> = {
  notice: "bg-[#e8b4c0]/40 text-[#650d2f]",
  fault: "bg-sky-50 text-sky-700",
  request: "bg-amber-50 text-amber-700",
};

const KIND_ICON: Record<ClinicalItem["kind"], "check" | "wrench" | "plus"> = {
  notice: "check",
  fault: "wrench",
  request: "plus",
};

function when(item: ClinicalItem, now: number) {
  if (!item.at || !now) return "";
  return isToday(item.at, now) ? timeAgo(item.at, now) : fmtShort(item.at);
}

export default function ClinicalBell() {
  const {
    items,
    load,
    loading,
    count,
    now,
    retry,
    markSeen,
    readFailed,
    marking,
  } = useClinicalNotices();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

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

  const failed = load?.failed ?? [];
  const nothingLoaded = !!load && load.known.length === 0;
  const kept = failed.some((source) => load?.known.includes(source));

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={
          count
            ? `Notifications, ${count} unread`
            : failed.length > 0
              ? "Some notifications could not be loaded"
              : "Notifications"
        }
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#650d2f] hover:bg-[#e8b4c0]/30"
      >
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
        {count === 0 && failed.length > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white ring-2 ring-white"
            aria-hidden="true"
          >
            !
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#e8b4c0] bg-white text-left shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-[#e8b4c0]/60 px-4 py-3">
            <div>
              <p className="text-base font-bold text-[#650d2f]">
                Notifications
              </p>
              <p className="text-sm text-gray-500">
                {!load
                  ? "Loading..."
                  : count
                    ? `${count} unread`
                    : failed.length > 0
                      ? "Some updates could not be loaded"
                      : "You are all caught up"}
              </p>
            </div>
            {count > 0 && (
              <button
                type="button"
                disabled={marking}
                onClick={() => markSeen(items.filter((item) => item.unread))}
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
                {failed
                  .map((source) => CLINICAL_SOURCE_LABEL[source])
                  .join(", ")}
                .{kept ? " Showing what was loaded before." : ""}
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

          {!load ? (
            <div
              role="status"
              aria-label="Loading notifications"
              className="flex flex-col gap-2 px-4 py-6"
            >
              {[0, 1, 2].map((row) => (
                <span
                  key={row}
                  className="h-12 animate-pulse rounded-lg bg-[#fbfaf7]"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500">
              {nothingLoaded || failed.length > 0
                ? "Nothing to show until the updates load."
                : "No updates yet. You will see here when a machine you reported is being repaired or is back in use."}
            </p>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-[#e8b4c0]/40 overflow-y-auto">
              {items.slice(0, 30).map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (item.unread) markSeen([item]);
                      setOpen(false);
                    }}
                    className={`flex gap-3 px-4 py-3 transition hover:bg-[#fbfaf7] ${
                      item.unread ? "bg-[#e8b4c0]/10" : ""
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${KIND_STYLE[item.kind]}`}
                      aria-hidden="true"
                    >
                      <Icon name={KIND_ICON[item.kind]} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-sm ${
                            item.unread
                              ? "font-bold text-[#1c2434]"
                              : "font-medium text-gray-600"
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="shrink-0 text-xs text-gray-400">
                          {when(item, now)}
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
