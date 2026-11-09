"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import {
  LEVELS,
  LEVEL_COLOR,
  LEVEL_LABEL,
  type DepartmentRow,
  type Level,
  type TrendBucket,
} from "../insights";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-2xl border border-rose/70 bg-white p-5 shadow-[0_1px_3px_rgba(101,13,47,0.06)] md:p-6 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-brand">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  note,
  href,
  icon,
  tone,
}: {
  label: string;
  value: number | string | null;
  note: string;
  href: string;
  icon: ReactNode;
  tone: "red" | "gold" | "brand" | "green";
}) {
  const tones = {
    red: "bg-red-50 dark:bg-red-500/15 text-red-600",
    gold: "bg-amber-50 dark:bg-amber-500/15 text-amber-600",
    brand: "bg-rose/40 text-brand",
    green: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600",
  };
  const bars = {
    red: "bg-red-500",
    gold: "bg-gold",
    brand: "bg-brand",
    green: "bg-emerald-500",
  };
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-rose/70 bg-white p-5 shadow-[0_1px_3px_rgba(101,13,47,0.06)] transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-2 focus-visible:outline-gold"
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${bars[tone]}`} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-gray-600">{label}</p>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900">
        {value ?? "—"}
      </p>
      <p
        className={`mt-1 text-sm ${value === null ? "font-semibold text-red-700" : "text-gray-500"}`}
      >
        {value === null ? "Not available. Use Retry above." : note}
      </p>
      <p className="mt-3 text-xs font-semibold text-brand opacity-0 transition group-hover:opacity-100">
        Open →
      </p>
    </Link>
  );
}

export function LevelPill({ level }: { level: Level }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{
        backgroundColor: `${LEVEL_COLOR[level]}1f`,
        color: LEVEL_COLOR[level],
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: LEVEL_COLOR[level] }}
      />
      {LEVEL_LABEL[level]}
    </span>
  );
}

export function AvailabilityRing({
  percent,
  total,
  unavailable,
}: {
  percent: number;
  total: number;
  unavailable: number;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const color =
    percent >= 90 ? "#10b981" : percent >= 75 ? "#d9a00a" : "#dc2626";
  return (
    <div className="flex items-center gap-5">
      <svg
        viewBox="0 0 140 140"
        className="h-36 w-36 shrink-0"
        role="img"
        aria-label={`${percent}% of approved equipment is available`}
      >
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          className="text-gray-100"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
        <text
          x="70"
          y="68"
          textAnchor="middle"
          className="fill-gray-900 text-[26px] font-bold"
        >
          {percent}%
        </text>
        <text
          x="70"
          y="88"
          textAnchor="middle"
          className="fill-gray-500 text-[11px]"
        >
          available
        </text>
      </svg>
      <div className="flex flex-col gap-3 text-sm">
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {total - unavailable}
          </p>
          <p className="text-gray-500">machines working</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-red-600">{unavailable}</p>
          <p className="text-gray-500">out of service or in repair</p>
        </div>
      </div>
    </div>
  );
}

export function PriorityDonut({
  counts,
  onPick,
  picked,
}: {
  counts: Record<Level, number>;
  onPick: (level: Level | "all") => void;
  picked: Level | "all";
}) {
  const [hover, setHover] = useState<Level | null>(null);
  const total = LEVELS.reduce((sum, level) => sum + counts[level], 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const focus = hover ?? (picked === "all" ? null : picked);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row xl:flex-col 2xl:flex-row">
      <svg
        viewBox="0 0 160 160"
        className="h-44 w-44 shrink-0"
        role="img"
        aria-label="Open faults by priority"
      >
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="22"
          className="text-gray-100"
        />
        {total > 0 &&
          LEVELS.map((level) => {
            const value = counts[level];
            if (!value) return null;
            const length = (value / total) * circumference;
            const dash = `${Math.max(0, length - 2)} ${circumference}`;
            const segment = (
              <circle
                key={level}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={LEVEL_COLOR[level]}
                strokeWidth={focus === level ? 28 : 22}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                transform="rotate(-90 80 80)"
                opacity={focus && focus !== level ? 0.35 : 1}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHover(level)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onPick(picked === level ? "all" : level)}
              />
            );
            offset += length;
            return segment;
          })}
        <text
          x="80"
          y="78"
          textAnchor="middle"
          className="fill-gray-900 text-[30px] font-bold"
        >
          {focus ? counts[focus] : total}
        </text>
        <text
          x="80"
          y="98"
          textAnchor="middle"
          className="fill-gray-500 text-[11px]"
        >
          {focus ? LEVEL_LABEL[focus] : "open faults"}
        </text>
      </svg>
      <ul className="grid w-full grid-cols-2 gap-2 sm:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-1">
        {LEVELS.map((level) => (
          <li key={level}>
            <button
              type="button"
              onMouseEnter={() => setHover(level)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick(picked === level ? "all" : level)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-gray-50 ${
                picked === level ? "bg-rose/30 font-semibold" : ""
              }`}
            >
              <span className="flex items-center gap-2 whitespace-nowrap text-gray-700">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: LEVEL_COLOR[level] }}
                />
                {LEVEL_LABEL[level]}
              </span>
              <span className="font-bold text-gray-900">{counts[level]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrendChart({ buckets }: { buckets: TrendBucket[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(
    1,
    ...buckets.map((b) => Math.max(b.reported, b.closed)),
  );
  const width = 640;
  const height = 220;
  const pad = { left: 28, right: 8, top: 12, bottom: 28 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / Math.max(1, buckets.length);
  const bar = Math.max(2, Math.min(14, slot / 2.6));
  const y = (value: number) => pad.top + plotH - (value / max) * plotH;
  const ticks = Array.from(new Set([0, Math.ceil(max / 2), max]));
  const labelEvery = Math.ceil(buckets.length / 8);
  const shown = active !== null ? buckets[active] : null;

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand dark:bg-[#f2a7bd]" />{" "}
          Reported
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Back in use
        </span>
        {shown && (
          <span className="ml-auto rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white">
            {shown.label}: {shown.reported} reported · {shown.closed} back in
            use
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Faults reported and machines back in use over time"
        onMouseLeave={() => setActive(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="currentColor"
              className="text-gray-200"
              strokeDasharray="3 4"
            />
            <text
              x={pad.left - 6}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-gray-400 text-[10px]"
            >
              {tick}
            </text>
          </g>
        ))}
        {buckets.map((bucket, index) => {
          const x = pad.left + index * slot + slot / 2;
          return (
            <g key={bucket.start} onMouseEnter={() => setActive(index)}>
              <rect
                x={pad.left + index * slot}
                y={pad.top}
                width={slot}
                height={plotH}
                fill={
                  active === index ? "rgba(232,180,192,0.25)" : "transparent"
                }
              />
              <rect
                x={x - bar - 1}
                y={y(bucket.reported)}
                width={bar}
                height={pad.top + plotH - y(bucket.reported)}
                rx="2"
                className="fill-brand dark:fill-[#f2a7bd]"
              />
              <rect
                x={x + 1}
                y={y(bucket.closed)}
                width={bar}
                height={pad.top + plotH - y(bucket.closed)}
                rx="2"
                fill="#10b981"
              />
              {index % labelEvery === 0 && (
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-gray-400 text-[10px]"
                >
                  {bucket.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DepartmentBars({
  rows,
  picked,
  onPick,
}: {
  rows: DepartmentRow[];
  picked: string;
  onPick: (department: string) => void;
}) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500">No open faults in any department.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.department}>
          <button
            type="button"
            onClick={() =>
              onPick(picked === row.department ? "all" : row.department)
            }
            className={`w-full rounded-xl px-3 py-2 text-left transition hover:bg-gray-50 ${
              picked === row.department ? "bg-rose/30 ring-1 ring-rose" : ""
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-800">
                {row.department}
              </span>
              <span className="font-bold text-gray-900">{row.total}</span>
            </div>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-gray-100"
              style={{ width: `${Math.max(12, (row.total / max) * 100)}%` }}
            >
              {LEVELS.map((level) =>
                row.counts[level] ? (
                  <span
                    key={level}
                    title={`${LEVEL_LABEL[level]}: ${row.counts[level]}`}
                    style={{
                      width: `${(row.counts[level] / row.total) * 100}%`,
                      backgroundColor: LEVEL_COLOR[level],
                    }}
                  />
                ) : null,
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Skeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <div className="h-16 w-1/2 animate-pulse rounded-2xl bg-gray-100" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-2xl bg-gray-100"
          />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="h-72 animate-pulse rounded-2xl bg-gray-100 xl:col-span-4" />
        <div className="h-72 animate-pulse rounded-2xl bg-gray-100 xl:col-span-8" />
      </div>
    </div>
  );
}

export function Unavailable({
  what,
  onRetry,
  retrying,
}: {
  what: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-200 bg-red-50/60 px-4 py-10 text-center dark:bg-red-500/10"
    >
      <p className="font-semibold text-red-700">Could not load {what}.</p>
      <p className="text-sm text-gray-600">
        These numbers are hidden so they are not mistaken for zero.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-white disabled:opacity-60"
      >
        {retrying ? "Retrying..." : "Retry"}
      </button>
    </div>
  );
}
