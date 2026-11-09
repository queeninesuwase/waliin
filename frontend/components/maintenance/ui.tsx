import type { ReactNode } from "react";

import type { PriorityLevel } from "@/lib/api/maintenance";

export const LEVEL_STYLES: Record<
  PriorityLevel,
  { label: string; badge: string; bar: string; dot: string }
> = {
  critical: {
    label: "Critical",
    badge: "bg-red-50 text-red-700 ring-red-200",
    bar: "bg-red-600",
    dot: "bg-red-600",
  },
  high: {
    label: "High",
    badge: "bg-orange-50 text-orange-700 ring-orange-200",
    bar: "bg-orange-500",
    dot: "bg-orange-500",
  },
  medium: {
    label: "Medium",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    bar: "bg-[#d9a00a]",
    dot: "bg-[#d9a00a]",
  },
  low: {
    label: "Low",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
};

export function LevelBadge({ level }: { level: PriorityLevel }) {
  const style = LEVEL_STYLES[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[#e8b4c0] bg-white p-5 shadow-[0_1px_2px_rgba(101,13,47,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#650d2f]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-gray-500 md:text-base">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-[#e8b4c0] bg-white p-8 text-center"
    >
      <p className="text-base text-[#650d2f]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="h-11 rounded-lg bg-[#650d2f] px-6 text-sm font-semibold text-white hover:bg-[#4e0a25]"
      >
        Retry
      </button>
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-xl border border-[#e8b4c0] bg-white"
        />
      ))}
    </div>
  );
}
