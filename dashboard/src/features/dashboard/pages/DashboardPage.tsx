"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  MonitorX,
  Package,
  PackageCheck,
  RefreshCw,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import {
  AvailabilityRing,
  DepartmentBars,
  KpiCard,
  LevelPill,
  Panel,
  PriorityDonut,
  Skeleton,
  TrendChart,
  Unavailable,
} from "@/features/dashboard/components/DashboardParts";
import {
  loadDashboard,
  SOURCE_LABEL,
  type DashboardData,
} from "@/features/dashboard/api";
import {
  allFaults,
  availability,
  availableFrom,
  departmentRows,
  durationHours,
  filterByDepartment,
  formatHours,
  levelCounts,
  openFaultRows,
  pendingDecisions,
  periodStats,
  REQUEST_TYPE_LABEL,
  requestLabel,
  requestOutlook,
  requestTitle,
  trendBuckets,
  type Level,
} from "@/features/dashboard/insights";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function statusText(status: string) {
  const text = status.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState(30);
  const [department, setDepartment] = useState("all");
  const [level, setLevel] = useState<Level | "all">("all");
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;
    loadDashboard()
      .then((result) => {
        if (!active) return;
        setData(result);
        setNow(Date.now());
        setError("");
      })
      .catch((err: unknown) => {
        if (active)
          setError(
            err instanceof Error && err.message
              ? err.message
              : "Could not load dashboard information.",
          );
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function refresh() {
    setRefreshing(true);
    setAttempt((count) => count + 1);
  }

  const view = useMemo(() => {
    if (!data) return null;
    const allRows = openFaultRows(data, now);
    const deptRows = filterByDepartment(allRows, department);
    const rows =
      level === "all"
        ? deptRows
        : deptRows.filter((row) => row.level === level);
    const deptIds = new Set(
      data.departments
        .filter((item) => item.department_name === department)
        .map((item) => item.department_id),
    );
    const machineDept = new Map(
      [...data.equipment, ...data.pendingEquipment].map((item) => [
        item.equipment_id,
        item.department_id,
      ]),
    );
    const everyFault = allFaults(data);
    const faults =
      department === "all"
        ? everyFault
        : everyFault.filter((fault) =>
            deptIds.has(machineDept.get(fault.equipment_id) ?? ""),
          );
    const decisions = pendingDecisions(data.requests);
    const ok = {
      faults: availableFrom(data, "faults"),
      priority: availableFrom(data, "priority"),
      triage: availableFrom(data, "faults", "priority"),
      machines: availableFrom(data, "equipment", "outOfService"),
      waiting: availableFrom(data, "pending", "requests"),
      requests: availableFrom(data, "requests"),
      report: availableFrom(data, "report"),
      overdue: availableFrom(data, "overdue"),
    };
    return {
      ok,
      allRows,
      rows,
      counts: levelCounts(deptRows),
      departments: departmentRows(allRows),
      trend: trendBuckets(faults, period, now),
      stats: periodStats(faults, period, now),
      ring: availability(data),
      decisions,
      outlook: requestOutlook(data.requests),
      urgent: allRows.filter(
        (row) => row.level === "critical" || row.level === "high",
      ).length,
      unassessed: allRows.filter((row) => row.level === "unassessed").length,
      waiting: data.pendingEquipment.length + decisions.length,
      longest: allRows.reduce((max, row) => Math.max(max, row.days), 0),
    };
  }, [data, department, level, period, now]);

  if (error && !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-2xl border border-rose bg-white p-10 text-center">
        <AlertTriangle className="h-10 w-10 text-brand" aria-hidden="true" />
        <p className="text-lg font-semibold text-gray-900">{error}</p>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg bg-brand px-6 py-3 text-base font-semibold text-white hover:bg-brand-dark"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data || !view) return <Skeleton />;

  const ok = view.ok;
  const retry = (what: string) => (
    <Unavailable what={what} onRetry={refresh} retrying={refreshing} />
  );

  const name = user?.full_name?.trim().split(" ")[0] ?? "";
  const today = new Date(now);
  const averageDowntime = durationHours(data.report?.downtime.average_downtime);
  const departmentOptions = [
    ...new Set([
      ...data.departments.map((item) => item.department_name),
      ...view.allRows.map((row) => row.department),
    ]),
  ].sort();

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide text-gold uppercase">
            {today.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-brand">
            {greeting(today)}
            {name ? `, ${name}` : ""}
          </h1>
          <p className="mt-1 text-base text-gray-500">
            Equipment health, decisions waiting for you and where to act first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Period"
            className="flex rounded-xl border border-rose bg-white p-1"
          >
            {PERIODS.map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => setPeriod(option.days)}
                aria-pressed={period === option.days}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  period === option.days
                    ? "bg-brand text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            aria-label="Department"
            className="h-11 rounded-xl border border-rose bg-white px-3 text-sm font-medium text-gray-700 outline-none focus:border-brand"
          >
            <option value="all">All departments</option>
            {departmentOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="flex h-11 items-center gap-2 rounded-xl border border-rose bg-white px-4 text-sm font-semibold text-brand hover:border-brand disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
          <a
            href="/api/reports/maintenance-summary/pdf"
            className="flex h-11 items-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-white hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download report
          </a>
        </div>
      </header>

      {(data.failed.some((source) => source !== "overdue") || error) && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-500/10"
        >
          <span>
            {error
              ? `${error} Showing the data from the last successful load.`
              : `Could not load: ${data.failed
                  .filter((source) => source !== "overdue")
                  .map((source) => SOURCE_LABEL[source])
                  .join(
                    ", ",
                  )}. Numbers that depend on them show — instead of zero.`}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            {refreshing ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Needs attention now"
          value={ok.priority ? view.urgent : null}
          note={
            ok.triage
              ? `Critical and high priority · ${view.unassessed} not assessed yet`
              : "Critical and high priority"
          }
          href="/equipment"
          tone="red"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="Out of service"
          value={ok.machines ? view.ring.unavailable : null}
          note={
            !ok.faults
              ? "Out of service or in repair"
              : view.longest
                ? `Longest open fault: ${view.longest} days`
                : "No long-running faults"
          }
          href="/equipment"
          tone="brand"
          icon={<MonitorX className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="Waiting for your decision"
          value={ok.waiting ? view.waiting : null}
          note={`${data.pendingEquipment.length} registrations · ${view.decisions.length} requests`}
          href="/requests"
          tone="gold"
          icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="Back in use"
          value={ok.faults ? view.stats.backInUse : null}
          note={`Last ${period} days · ${view.stats.reported} new faults reported`}
          href="/equipment"
          tone="green"
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <Panel
          title="Equipment availability"
          subtitle="Approved machines working right now"
          className="xl:col-span-4"
        >
          {ok.machines ? (
            <AvailabilityRing
              percent={view.ring.percent}
              total={view.ring.total}
              unavailable={view.ring.unavailable}
            />
          ) : (
            retry("equipment availability")
          )}
          <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-rose/60 pt-5">
            <div className="rounded-xl bg-cream p-3">
              <dt className="text-xs text-gray-500">Average repair time</dt>
              <dd className="mt-1 text-xl font-bold text-gray-900">
                {ok.faults ? formatHours(view.stats.averageRepairHours) : "—"}
              </dd>
            </div>
            <div className="rounded-xl bg-cream p-3">
              <dt className="text-xs text-gray-500">Average downtime</dt>
              <dd className="mt-1 text-xl font-bold text-gray-900">
                {ok.report ? formatHours(averageDowntime) : "—"}
              </dd>
            </div>
            <div className="rounded-xl bg-cream p-3">
              <dt className="text-xs text-gray-500">Repairs completed</dt>
              <dd className="mt-1 text-xl font-bold text-gray-900">
                {ok.report && data.report
                  ? data.report.repairs.repairs_completed
                  : "—"}
              </dd>
            </div>
            <div className="rounded-xl bg-cream p-3">
              <dt className="text-xs text-gray-500">Open faults</dt>
              <dd className="mt-1 text-xl font-bold text-gray-900">
                {ok.triage ? view.allRows.length : "—"}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel
          title="Faults over time"
          subtitle={`New faults against machines back in use · last ${period} days${
            department === "all" ? "" : ` · ${department}`
          }`}
          className="xl:col-span-8"
          action={<Activity className="h-5 w-5 text-gold" aria-hidden="true" />}
        >
          {ok.faults ? (
            <TrendChart buckets={view.trend} />
          ) : (
            retry("the fault history")
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <Panel
          title="Waiting for your decision"
          subtitle="Oldest first"
          className="xl:col-span-5"
          action={
            <span className="rounded-full bg-gold/15 px-3 py-1 text-sm font-bold text-amber-700">
              {ok.waiting ? view.waiting : "—"}
            </span>
          }
        >
          {!ok.waiting ? (
            retry("registrations and requests waiting for you")
          ) : view.waiting === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
              <PackageCheck
                className="h-10 w-10 text-emerald-500"
                aria-hidden="true"
              />
              <p className="font-semibold text-gray-900">All caught up</p>
              <p className="text-sm text-gray-500">
                No registrations or requests are waiting.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-rose/50">
              {data.pendingEquipment.slice(0, 4).map((item) => (
                <li
                  key={item.equipment_id}
                  className="flex items-center gap-3 py-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose/40 text-brand">
                    <Wrench className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">
                      {item.model_name}
                    </p>
                    <p className="truncate text-sm text-gray-500">
                      New registration · {item.asset_tag} ·{" "}
                      {shortDate(item.created_at)}
                    </p>
                  </div>
                  <Link
                    href="/equipment"
                    className="shrink-0 rounded-lg border border-brand px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand hover:text-white"
                  >
                    Review
                  </Link>
                </li>
              ))}
              {view.decisions.slice(0, 4).map((request) => (
                <li
                  key={request.request_id}
                  className="flex items-center gap-3 py-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600">
                    <Package className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">
                      {requestTitle(request)}
                    </p>
                    <p className="truncate text-sm text-gray-500">
                      {requestLabel(request)}
                      {request.requester_name
                        ? ` · ${request.requester_name}`
                        : ""}{" "}
                      · {shortDate(request.requested_at)}
                    </p>
                  </div>
                  <Link
                    href={`/requests/${encodeURIComponent(request.request_id)}`}
                    className="shrink-0 rounded-lg border border-brand px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand hover:text-white"
                  >
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {!ok.overdue && (
            <p className="mt-4 text-sm text-gray-500">
              Overdue follow-ups could not be checked right now.
            </p>
          )}
          {ok.overdue && data.overdue.length > 0 && (
            <p className="mt-4 rounded-xl bg-red-50 dark:bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-700">
              {data.overdue.length} sent request
              {data.overdue.length === 1 ? " has" : "s have"} no reply after the
              follow-up date.
            </p>
          )}
        </Panel>

        <Panel
          title="Open faults by priority"
          subtitle="Click a priority to filter"
          className="xl:col-span-3"
        >
          {ok.priority ? (
            <PriorityDonut
              counts={view.counts}
              picked={level}
              onPick={setLevel}
            />
          ) : (
            retry("fault priorities")
          )}
        </Panel>

        <Panel
          title="Faults by department"
          subtitle="Click a department to filter"
          className="xl:col-span-4"
        >
          {ok.priority ? (
            <DepartmentBars
              rows={view.departments}
              picked={department}
              onPick={setDepartment}
            />
          ) : (
            retry("faults by department")
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <Panel
          title="Machines waiting for repair"
          subtitle={`Most urgent and longest waiting first${
            level === "all" ? "" : ` · ${level}`
          }${department === "all" ? "" : ` · ${department}`}`}
          className="xl:col-span-8"
          action={
            level !== "all" || department !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setLevel("all");
                  setDepartment("all");
                }}
                className="text-sm font-semibold text-brand hover:underline"
              >
                Clear filters
              </button>
            ) : undefined
          }
        >
          {ok.priority && !ok.faults && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/15">
              Showing assessed faults only. New, unassessed reports could not be
              loaded.
            </p>
          )}
          {!ok.priority ? (
            retry("machines waiting for repair")
          ) : view.rows.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
              <CheckCircle2
                className="h-10 w-10 text-emerald-500"
                aria-hidden="true"
              />
              <p className="font-semibold text-gray-900">No open faults here</p>
              <p className="text-sm text-gray-500">
                Every machine in this view is working.
              </p>
            </div>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                    <th className="px-2 pb-3">Machine</th>
                    <th className="px-2 pb-3">Department</th>
                    <th className="px-2 pb-3">Priority</th>
                    <th className="px-2 pb-3">Status</th>
                    <th className="px-2 pb-3 text-right">Waiting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose/50">
                  {view.rows.slice(0, 8).map((row) => (
                    <tr key={row.faultId} className="hover:bg-cream">
                      <td className="px-2 py-3">
                        <Link
                          href={`/equipment/${encodeURIComponent(row.equipmentId)}`}
                          className="font-semibold text-gray-900 hover:text-brand"
                        >
                          {row.name}
                        </Link>
                        <p className="max-w-[260px] truncate text-sm text-gray-500">
                          {row.assetTag ? `${row.assetTag} · ` : ""}
                          {row.description.split("\n")[0]}
                        </p>
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-700">
                        {row.department}
                      </td>
                      <td className="px-2 py-3">
                        <LevelPill level={row.level} />
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-700">
                        {statusText(row.status)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <span
                          className={`rounded-full px-2.5 py-1 text-sm font-bold ${
                            row.days >= 7
                              ? "bg-red-50 dark:bg-red-500/15 text-red-700"
                              : row.days >= 3
                                ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {row.days === 0 ? "Today" : `${row.days} d`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {view.rows.length > 8 && (
                <p className="mt-3 px-2 text-sm text-gray-500">
                  Showing 8 of {view.rows.length}.
                </p>
              )}
            </div>
          )}
        </Panel>

        <Panel
          title="Parts and replacement outlook"
          subtitle="Open requests to plan the budget"
          className="xl:col-span-4"
          action={
            <Link
              href="/requests"
              className="text-sm font-semibold text-brand hover:underline"
            >
              All requests
            </Link>
          }
        >
          {!ok.requests ? (
            retry("open requests")
          ) : view.outlook.length === 0 ? (
            <p className="text-sm text-gray-500">No open requests.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {view.outlook.map((row) => {
                const most = Math.max(...view.outlook.map((r) => r.requests));
                return (
                  <li key={row.type} className="rounded-xl bg-cream p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-gray-900">
                        {REQUEST_TYPE_LABEL[row.type] ?? row.type}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="text-lg font-bold text-gray-900">
                          {row.requests}
                        </span>{" "}
                        request{row.requests === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gold"
                        style={{ width: `${(row.requests / most) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      {row.items} item{row.items === 1 ? "" : "s"} requested
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-rose/60 px-4 py-3 text-sm">
            <span className="text-gray-600">Resolved requests</span>
            <span className="font-bold text-gray-900">
              {ok.report && data.report
                ? data.report.resource_requests.resolved_requests
                : "—"}
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
