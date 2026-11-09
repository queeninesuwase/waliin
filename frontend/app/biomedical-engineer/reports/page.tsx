"use client";

import {
  Activity,
  Clock3,
  Download,
  FileWarning,
  MonitorX,
  PackageCheck,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  Card,
  LEVEL_STYLES,
  LoadError,
  PageTitle,
  Skeleton,
} from "@/components/maintenance/ui";
import {
  downloadMaintenancePdf,
  durationHours,
  errorMessage,
  formatHours,
  getMaintenanceSummary,
  type MaintenanceSummary,
  type PriorityLevel,
} from "@/lib/api/maintenance";

const LEVELS: PriorityLevel[] = ["critical", "high", "medium", "low"];

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<MaintenanceSummary | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let active = true;
    getMaintenanceSummary().then(
      (result) => {
        if (active) setSummary(result);
      },
      (err: unknown) => {
        if (active) setError(errorMessage(err, "Could not load the report."));
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setError("");
    setSummary(null);
    setAttempt((count) => count + 1);
  }, []);

  async function download() {
    setDownloading(true);
    setDownloadError("");
    try {
      await downloadMaintenancePdf();
    } catch (err) {
      setDownloadError(
        errorMessage(err, "Could not create the PDF. Try again."),
      );
    }
    setDownloading(false);
  }

  return (
    <div className="min-h-full bg-[#F8F6F3] px-4 py-6 md:px-8 md:py-8 lg:px-10">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <PageTitle
          title="Reports"
          subtitle="Faults, downtime, repairs and requests across the hospital."
          action={
            <button
              type="button"
              onClick={download}
              disabled={downloading || !summary}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#d9a00a] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {downloading ? "Preparing PDF..." : "Download PDF"}
            </button>
          }
        />

        {downloadError && (
          <p
            role="alert"
            className="rounded-lg bg-[#e8b4c0]/30 px-4 py-3 text-sm text-[#650d2f]"
          >
            {downloadError}
          </p>
        )}
        {error && <LoadError message={error} onRetry={retry} />}
        {!summary && !error && <Skeleton rows={3} />}

        {summary && <ReportContent summary={summary} />}
      </div>
    </div>
  );
}

function ReportContent({ summary }: { summary: MaintenanceSummary }) {
  const { faults, priorities, downtime, repairs, resource_requests } = summary;
  const totalPriorities = LEVELS.reduce(
    (sum, level) => sum + (priorities[level] ?? 0),
    0,
  );
  const totalRequests =
    resource_requests.pending_requests + resource_requests.resolved_requests;
  const averageHours = durationHours(downtime.average_downtime);
  const totalHours = durationHours(downtime.total_downtime);
  const returnRate = percent(
    repairs.equipment_returned_to_service,
    faults.total_faults,
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<FileWarning className="h-5 w-5" aria-hidden="true" />}
          label="Faults reported"
          value={String(faults.total_faults)}
          note={`${faults.open_faults} open · ${faults.closed_faults} closed`}
        />
        <Kpi
          icon={<MonitorX className="h-5 w-5" aria-hidden="true" />}
          label="Still out of service"
          value={String(downtime.equipment_still_down)}
          note="Machines patients cannot use now"
          highlight={downtime.equipment_still_down > 0}
        />
        <Kpi
          icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
          label="Average downtime"
          value={formatHours(averageHours)}
          note="Per fault, from report to back in use"
        />
        <Kpi
          icon={<PackageCheck className="h-5 w-5" aria-hidden="true" />}
          label="Back in use"
          value={String(repairs.equipment_returned_to_service)}
          note={`${repairs.repairs_completed} repairs completed`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="text-lg font-bold text-[#650d2f]">
            Open faults by priority
          </h2>
          <p className="text-sm text-gray-500">
            From the engineers&apos; assessments.
          </p>
          <div className="mt-6 flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
            {LEVELS.map((level) =>
              priorities[level] ? (
                <span
                  key={level}
                  className={LEVEL_STYLES[level].bar}
                  style={{
                    width: `${percent(priorities[level], totalPriorities)}%`,
                  }}
                  title={`${LEVEL_STYLES[level].label}: ${priorities[level]}`}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-6 flex flex-col gap-4">
            {LEVELS.map((level) => (
              <li key={level}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium text-gray-900">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${LEVEL_STYLES[level].dot}`}
                    />
                    {LEVEL_STYLES[level].label}
                  </span>
                  <span className="text-gray-500">
                    <b className="text-gray-900">{priorities[level] ?? 0}</b> ·{" "}
                    {percent(priorities[level] ?? 0, totalPriorities)}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                  <div
                    className={`h-2 rounded-full ${LEVEL_STYLES[level].bar}`}
                    style={{
                      width: `${percent(priorities[level] ?? 0, totalPriorities)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {totalPriorities === 0 && (
            <p className="mt-4 text-sm text-gray-500">
              No assessed open faults right now.
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#650d2f]">
              <Activity className="h-5 w-5" aria-hidden="true" />
              Downtime
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-[#fbfaf7] p-4">
                <dt className="text-xs text-gray-500">Total</dt>
                <dd className="mt-1 text-2xl font-bold text-gray-900">
                  {formatHours(totalHours)}
                </dd>
              </div>
              <div className="rounded-lg bg-[#fbfaf7] p-4">
                <dt className="text-xs text-gray-500">Average per fault</dt>
                <dd className="mt-1 text-2xl font-bold text-gray-900">
                  {formatHours(averageHours)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#650d2f]">
              <Wrench className="h-5 w-5" aria-hidden="true" />
              Repairs and requests
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              <Meter
                label="Faults returned to service"
                value={repairs.equipment_returned_to_service}
                total={faults.total_faults}
                percentValue={returnRate}
                bar="bg-emerald-500"
              />
              <Meter
                label="Requests resolved"
                value={resource_requests.resolved_requests}
                total={totalRequests}
                percentValue={percent(
                  resource_requests.resolved_requests,
                  totalRequests,
                )}
                bar="bg-[#650d2f]"
              />
              <p className="text-sm text-gray-500">
                {resource_requests.pending_requests} request
                {resource_requests.pending_requests === 1 ? "" : "s"} still
                waiting for a reply.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Kpi({
  icon,
  label,
  value,
  note,
  highlight = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <span className="flex items-center justify-between text-sm font-semibold text-gray-700">
        {label}
        <span className="text-[#650d2f]">{icon}</span>
      </span>
      <span
        className={`text-3xl font-bold ${highlight ? "text-red-700" : "text-[#650d2f]"}`}
      >
        {value}
      </span>
      <span className="text-xs text-gray-500">{note}</span>
    </Card>
  );
}

function Meter({
  label,
  value,
  total,
  percentValue,
  bar,
}: {
  label: string;
  value: number;
  total: number;
  percentValue: number;
  bar: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-900">{label}</span>
        <span className="text-gray-500">
          <b className="text-gray-900">{value}</b> of {total} · {percentValue}%
        </span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full ${bar}`}
          style={{ width: `${percentValue}%` }}
        />
      </div>
    </div>
  );
}
