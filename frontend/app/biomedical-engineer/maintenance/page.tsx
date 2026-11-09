"use client";

import {
  AlertTriangle,
  Clock3,
  Search,
  ShieldCheck,
  Stethoscope,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import WorkPanel, { type WorkTarget } from "@/components/maintenance/WorkPanel";
import {
  Card,
  LEVEL_STYLES,
  LevelBadge,
  LoadError,
  PageTitle,
  Skeleton,
} from "@/components/maintenance/ui";
import { useUserProfile } from "@/components/providers/UserProfileProvider";
import {
  durationHours,
  errorMessage,
  formatHours,
  getEquipmentBrief,
  getFaults,
  getPriorityList,
  hoursSince,
  levelOf,
  OPEN_STATUSES,
  statusLabel,
  type EquipmentBrief,
  type FaultRow,
  type PriorityItem,
  type PriorityLevel,
} from "@/lib/api/maintenance";

type Data = {
  priority: PriorityItem[];
  waiting: { fault: FaultRow; equipment: EquipmentBrief | null }[];
};

type Filter = "all" | PriorityLevel;
type View = "priority" | "waiting";

async function loadMaintenance(): Promise<Data> {
  const [priority, faults] = await Promise.all([
    getPriorityList(),
    getFaults(),
  ]);
  const assessed = new Set(priority.map((item) => item.fault_id));
  const open = faults.filter(
    (fault) => OPEN_STATUSES.has(fault.status) && !assessed.has(fault.fault_id),
  );
  const ids = [...new Set(open.map((fault) => fault.equipment_id))];
  const equipment = new Map(
    await Promise.all(
      ids.map(
        async (id) =>
          [id, await getEquipmentBrief(id).catch(() => null)] as const,
      ),
    ),
  );
  return {
    priority,
    waiting: open
      .sort((a, b) => Date.parse(a.reported_at) - Date.parse(b.reported_at))
      .map((fault) => ({
        fault,
        equipment: equipment.get(fault.equipment_id) ?? null,
      })),
  };
}

export default function MaintenancePage() {
  const { user } = useUserProfile();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View>("priority");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [downOnly, setDownOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [target, setTarget] = useState<WorkTarget | null>(null);

  useEffect(() => {
    let active = true;
    loadMaintenance().then(
      (result) => {
        if (active) setData(result);
      },
      (err: unknown) => {
        if (active)
          setError(errorMessage(err, "Could not load the maintenance list."));
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setError("");
    setData(null);
    setAttempt((count) => count + 1);
  }, []);

  const closePanel = useCallback(() => setTarget(null), []);

  const counts = useMemo(() => {
    const result: Record<PriorityLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const item of data?.priority ?? [])
      result[levelOf(item.priority_level)] += 1;
    return result;
  }, [data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.priority ?? []).filter((item) => {
      if (filter !== "all" && levelOf(item.priority_level) !== filter)
        return false;
      if (downOnly && !item.still_down) return false;
      if (mineOnly && item.assigned_engineer_id !== user?.user_id) return false;
      if (!term) return true;
      return [item.equipment_name, item.asset_tag, item.department_name]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data, filter, search, downOnly, mineOnly, user]);

  const stillDown = (data?.priority ?? []).filter(
    (item) => item.still_down,
  ).length;

  return (
    <div className="min-h-full bg-[#F8F6F3] px-4 py-6 md:px-8 md:py-8 lg:px-10">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <PageTitle
          title="Maintenance"
          subtitle="Work on the most urgent machines first, then test them before they go back into use."
          action={
            <button
              type="button"
              onClick={retry}
              className="h-11 rounded-lg border border-[#650d2f] px-5 text-sm font-semibold text-[#650d2f] hover:bg-[#650d2f] hover:text-white"
            >
              Refresh
            </button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
            label="Critical and high"
            value={data ? counts.critical + counts.high : null}
            note="Fix these first"
            tone="text-red-700"
          />
          <Stat
            icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
            label="Still out of service"
            value={data ? stillDown : null}
            note="Patients are waiting on these"
            tone="text-[#650d2f]"
          />
          <Stat
            icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
            label="In the priority list"
            value={data ? data.priority.length : null}
            note="Assessed and ranked"
            tone="text-[#650d2f]"
          />
          <Stat
            icon={<Stethoscope className="h-5 w-5" aria-hidden="true" />}
            label="Waiting for assessment"
            value={data ? data.waiting.length : null}
            note="Reported, not assessed yet"
            tone="text-[#b07f00]"
          />
        </div>

        <div role="tablist" className="flex gap-6 border-b border-[#e8b4c0]">
          {(
            [
              ["priority", "Priority list", data?.priority.length],
              ["waiting", "Waiting for assessment", data?.waiting.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold ${
                view === value
                  ? "border-[#650d2f] text-[#650d2f]"
                  : "border-transparent text-gray-500 hover:text-[#650d2f]"
              }`}
            >
              {label}
              <span className="rounded-full bg-[#e8b4c0]/40 px-2 py-0.5 text-xs">
                {count ?? "–"}
              </span>
            </button>
          ))}
        </div>

        {error && <LoadError message={error} onRetry={retry} />}
        {!data && !error && <Skeleton rows={4} />}

        {data && view === "priority" && (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search equipment, asset tag or department"
                  aria-label="Search the priority list"
                  className="h-11 w-full rounded-lg border border-[#e8b4c0] bg-white pr-3 pl-9 text-sm text-gray-900 focus:border-[#650d2f] focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "critical", "high", "medium", "low"] as const).map(
                  (value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                      className={`h-10 rounded-full px-4 text-sm font-semibold ring-1 ${
                        filter === value
                          ? "bg-[#650d2f] text-white ring-[#650d2f]"
                          : "bg-white text-gray-600 ring-[#e8b4c0] hover:text-[#650d2f]"
                      }`}
                    >
                      {value === "all"
                        ? `All ${data.priority.length}`
                        : `${LEVEL_STYLES[value].label} ${counts[value]}`}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-5 text-sm text-gray-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={downOnly}
                  onChange={(event) => setDownOnly(event.target.checked)}
                  className="h-4 w-4 accent-[#650d2f]"
                />
                Only machines still out of service
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mineOnly}
                  onChange={(event) => setMineOnly(event.target.checked)}
                  className="h-4 w-4 accent-[#650d2f]"
                />
                Only faults assigned to me
              </label>
            </div>

            {rows.length === 0 ? (
              <Card className="py-10 text-center">
                <ShieldCheck
                  className="mx-auto h-10 w-10 text-emerald-600"
                  aria-hidden="true"
                />
                <p className="mt-3 text-base font-semibold text-gray-900">
                  {data.priority.length === 0
                    ? "Nothing in the priority list"
                    : "No machine matches these filters"}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {data.priority.length === 0
                    ? "Faults appear here after you assess them."
                    : "Try another level or clear the search."}
                </p>
              </Card>
            ) : (
              <ol className="flex flex-col gap-3">
                {rows.map((item, index) => {
                  const level = levelOf(item.priority_level);
                  const downHours = item.downtime
                    ? durationHours(item.downtime)
                    : hoursSince(item.reported_at);
                  return (
                    <li key={item.fault_id}>
                      <Card className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="flex items-start gap-4 lg:w-[34%]">
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${LEVEL_STYLES[level].bar}`}
                          >
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-gray-900">
                              {item.equipment_name}
                            </p>
                            <p className="truncate text-sm text-gray-500">
                              {item.asset_tag} · {item.department_name}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 lg:w-[22%]">
                          <LevelBadge level={level} />
                          <span className="text-xs text-gray-500">
                            Score {item.priority_score}
                          </span>
                        </div>
                        <dl className="grid flex-1 grid-cols-3 gap-3 text-sm">
                          <div>
                            <dt className="text-xs text-gray-500">Status</dt>
                            <dd className="font-medium text-gray-900">
                              {statusLabel(item.fault_status)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500">Downtime</dt>
                            <dd
                              className={`font-medium ${item.still_down ? "text-red-700" : "text-gray-900"}`}
                            >
                              {item.still_down === false
                                ? "Running"
                                : formatHours(downHours)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500">Backup</dt>
                            <dd className="font-medium text-gray-900">
                              {item.backup_available ? "Available" : "None"}
                            </dd>
                          </div>
                        </dl>
                        <button
                          type="button"
                          onClick={() =>
                            setTarget({
                              faultId: item.fault_id,
                              equipmentName: item.equipment_name,
                              assetTag: item.asset_tag,
                              department: item.department_name,
                              status: item.fault_status,
                            })
                          }
                          className="h-11 shrink-0 rounded-lg bg-[#650d2f] px-5 text-sm font-semibold text-white hover:bg-[#4e0a25]"
                        >
                          Work on it
                        </button>
                      </Card>
                      {item.priority_explanation && (
                        <p className="mt-1 px-5 text-xs text-gray-500">
                          Why: {item.priority_explanation}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}

        {data && view === "waiting" && (
          <>
            {data.waiting.length === 0 ? (
              <Card className="py-10 text-center">
                <ShieldCheck
                  className="mx-auto h-10 w-10 text-emerald-600"
                  aria-hidden="true"
                />
                <p className="mt-3 text-base font-semibold text-gray-900">
                  Every open fault is assessed
                </p>
              </Card>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {data.waiting.map(({ fault, equipment }) => (
                  <li key={fault.fault_id}>
                    <Card className="flex h-full flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-gray-900">
                            {equipment
                              ? `${equipment.manufacturer} ${equipment.model_name}`
                              : "Equipment"}
                          </p>
                          <p className="truncate text-sm text-gray-500">
                            {equipment
                              ? `${equipment.asset_tag} · ${equipment.location}`
                              : ""}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#d9a00a]/15 px-2.5 py-1 text-xs font-semibold text-[#8a6300]">
                          {statusLabel(fault.severity)}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-gray-700">
                        {fault.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        Reported {formatHours(hoursSince(fault.reported_at))}{" "}
                        ago · {statusLabel(fault.status)}
                      </p>
                      <Link
                        href={`/biomedical-engineer/faults/${fault.fault_id}`}
                        className="mt-auto inline-flex h-10 items-center justify-center rounded-lg border border-[#650d2f] text-sm font-semibold text-[#650d2f] hover:bg-[#650d2f] hover:text-white"
                      >
                        Assess this fault
                      </Link>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {target && user && (
        <WorkPanel
          target={target}
          engineerId={user.user_id}
          onClose={closePanel}
          onReleased={() => {
            setTarget(null);
            retry();
          }}
        />
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number | null;
  note: string;
  tone: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <span className="flex items-center justify-between text-sm font-semibold text-gray-700">
        {label}
        <span className={tone}>{icon}</span>
      </span>
      <span className={`text-3xl font-bold ${tone}`}>{value ?? "–"}</span>
      <span className="text-xs text-gray-500">{note}</span>
    </Card>
  );
}
