"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AppShell from "@/components/AppShell";
import { ErrorBox } from "@/components/requests/Feedback";
import { CurrentUser } from "@/lib/session";
import {
  ErrorBanner,
  Icon,
  RequestChip,
  StatusChip,
} from "@/components/waliin/ui";
import { useMyFaults } from "@/components/waliin/useMyFaults";
import styles from "@/components/waliin/waliin.module.css";
import {
  Equipment,
  EquipmentRequest,
  ROUTES,
  displayName,
  equipmentName,
  equipmentRequestStatus,
  faultTitle,
  fetchEquipmentOptions,
  fetchMyEquipmentRequests,
  fmtDate,
  greeting,
  isOpen,
  messageOf,
  newReportFor,
  refOf,
  requestItemName,
  requestRef,
  serviceStatus,
  statusOf,
  wardMachines,
} from "@/lib/waliin";

const MONTH_MS = 30 * 86_400_000;

const DOT = {
  ok: "bg-emerald-500",
  down: "bg-red-600",
  work: "bg-amber-500",
  idle: "bg-gray-300",
};

type Loaded<T> = {
  data: T | null;
  error: string;
  loading: boolean;
  retry: () => void;
};

function useLoad<T>(load: () => Promise<T>): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    load()
      .then((value) => {
        if (!alive) return;
        setData(value);
        setError("");
      })
      .catch((e) => {
        if (alive) setError(messageOf(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [load, attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  return { data, error, loading, retry };
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-[#e8b4c0] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#650d2f]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i} className="h-12 animate-pulse rounded-xl bg-[#fbfaf7]" />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: number | null;
  hint: string;
  tone: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#e8b4c0] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="text-sm font-semibold text-[#1c2434]">{label}</p>
      <p className={`mt-2 text-4xl font-extrabold ${tone}`}>
        {value === null ? "—" : value}
      </p>
      <p className="mt-1 text-sm text-gray-500">{hint}</p>
    </Link>
  );
}

const ACTIONS = [
  {
    href: ROUTES.newRequest,
    icon: "wrench" as const,
    title: "Report a fault",
    text: "A machine stopped working or behaves strangely.",
    dark: true,
  },
  {
    href: ROUTES.newEquipmentRequest,
    icon: "plus" as const,
    title: "Request equipment",
    text: "Your ward needs a machine it does not have.",
    dark: false,
  },
];

function Content({ user }: { user: CurrentUser }) {
  const faults = useMyFaults(user.user_id);
  const departmentId = user.department_id ?? null;
  const loadWard = useCallback(
    () => fetchEquipmentOptions(departmentId),
    [departmentId],
  );
  const loadRequests = useCallback(
    () => fetchMyEquipmentRequests(user.user_id),
    [user.user_id],
  );
  const ward = useLoad<Equipment[]>(loadWard);
  const downCount =
    ward.data?.filter((e) => serviceStatus(e).tone === "down").length ?? 0;
  const requests = useLoad<EquipmentRequest[]>(loadRequests);
  const name = displayName(user);
  const [now] = useState(() => Date.now());

  const stats = useMemo(() => {
    if (!faults.rows) return null;
    const list = faults.rows.map((row) => row.fault);
    return {
      open: list.filter(isOpen).length,
      repair: list.filter((f) => statusOf(f) === "In repair").length,
      part: list.filter((f) => statusOf(f) === "Waiting for part").length,
      back: list.filter(
        (f) =>
          statusOf(f) === "Back in use" &&
          now - Date.parse(f.closed_at ?? f.updated_at) < MONTH_MS,
      ).length,
    };
  }, [faults.rows, now]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h2 className="text-3xl font-extrabold text-[#650d2f]">
          {greeting()}
          {name ? `, ${name.split(" ")[0]}` : ""}
        </h2>
        <p className="mt-1 text-base text-gray-500">
          Report broken machines and follow them until they are back in use.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`group flex items-center gap-4 rounded-2xl p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              action.dark
                ? "bg-[#650d2f] text-white"
                : "border border-[#e8b4c0] bg-white text-[#650d2f]"
            }`}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                action.dark ? "bg-white/15" : "bg-[#fdf3d7] text-[#b07d00]"
              }`}
            >
              <Icon name={action.icon} size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold">{action.title}</span>
              <span
                className={`block text-sm ${
                  action.dark ? "text-white/80" : "text-gray-500"
                }`}
              >
                {action.text}
              </span>
            </span>
            <Icon name="arrow" size={18} />
          </Link>
        ))}
      </div>

      {faults.error && faults.rows !== null && (
        <ErrorBanner
          message="Could not refresh your fault reports."
          onRetry={faults.reload}
          busy={faults.loading}
          kept
        />
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Open reports"
          value={stats?.open ?? null}
          hint="Not back in use yet"
          tone="text-[#650d2f]"
          href={ROUTES.requests}
        />
        <StatCard
          label="Being repaired"
          value={stats?.repair ?? null}
          hint="The engineer is on it"
          tone="text-sky-700"
          href={ROUTES.requests}
        />
        <StatCard
          label="Waiting for a part"
          value={stats?.part ?? null}
          hint="Part or outside help asked for"
          tone="text-amber-600"
          href={ROUTES.requests}
        />
        <StatCard
          label="Back in use"
          value={stats?.back ?? null}
          hint="Passed a test in the last 30 days"
          tone="text-emerald-600"
          href={ROUTES.requests}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          title="My recent fault reports"
          action={
            <Link href={ROUTES.requests} className={styles.link}>
              See all
            </Link>
          }
        >
          {faults.error && faults.rows === null ? (
            <ErrorBox
              title="Could not load your fault reports"
              message={faults.error}
              onRetry={faults.reload}
            />
          ) : faults.rows === null ? (
            <Skeleton rows={4} />
          ) : faults.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-[#fbfaf7] px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8b4c0]/40 text-[#650d2f]">
                <Icon name="wrench" size={22} />
              </span>
              <p className="font-semibold text-[#1c2434]">
                You have not reported a fault yet
              </p>
              <p className="max-w-sm text-sm text-gray-500">
                When a machine stops working, report it here so the engineer
                knows right away.
              </p>
              <Link
                href={ROUTES.newRequest}
                className="rounded-lg bg-[#650d2f] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Report a fault
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[#e8b4c0]/50">
              {faults.rows.slice(0, 6).map(({ fault, equipment }) => (
                <li key={fault.fault_id}>
                  <Link
                    href={ROUTES.request(fault.fault_id)}
                    className="flex items-center gap-4 rounded-xl px-2 py-3 transition hover:bg-[#fbfaf7]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8b4c0]/30 text-[#650d2f]">
                      <Icon name="monitor" size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[#1c2434]">
                        {equipmentName(equipment)}
                        {equipment?.asset_tag
                          ? ` · ${equipment.asset_tag}`
                          : ""}
                      </span>
                      <span className="block truncate text-sm text-gray-500">
                        {faultTitle(fault)}
                      </span>
                    </span>
                    <span className="hidden text-right text-sm text-gray-500 sm:block">
                      {refOf(fault.fault_id)}
                      <span className="block">
                        {fmtDate(fault.reported_at)}
                      </span>
                    </span>
                    <StatusChip status={statusOf(fault)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Machines in your ward"
            action={
              ward.data ? (
                <span className="text-sm text-gray-500">
                  {ward.data.length} machines
                </span>
              ) : undefined
            }
          >
            {ward.error && ward.data === null ? (
              <ErrorBox
                title="Could not load your ward's machines"
                message={ward.error}
                onRetry={ward.retry}
              />
            ) : ward.data === null ? (
              <Skeleton rows={3} />
            ) : (
              <>
                {ward.error && (
                  <ErrorBanner
                    message="Could not refresh this list."
                    onRetry={ward.retry}
                    busy={ward.loading}
                    kept
                  />
                )}
                {ward.data.length === 0 ? (
                  <p className="rounded-xl bg-[#fbfaf7] px-4 py-4 text-sm text-gray-500">
                    No approved machines are registered for your ward yet. Ask
                    your biomedical engineer to register them.
                  </p>
                ) : (
                  <>
                    {downCount === 0 ? (
                      <div className="mb-3 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        <Icon name="check" size={18} />
                        No machine in your ward is out of service.
                      </div>
                    ) : (
                      <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                        {downCount} out of service
                      </div>
                    )}
                    <ul className="flex max-h-[22rem] flex-col gap-2 overflow-y-auto pr-1">
                      {wardMachines(ward.data).map((e) => {
                        const status = serviceStatus(e);
                        return (
                          <li
                            key={e.equipment_id}
                            className="flex items-center gap-3 rounded-xl border border-[#e8b4c0]/60 px-3 py-2.5"
                          >
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[status.tone]}`}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-[#1c2434]">
                                {equipmentName(e)} · {e.asset_tag}
                              </span>
                              <span className="block truncate text-xs text-gray-500">
                                {status.label}
                                {e.location ? ` · ${e.location}` : ""}
                              </span>
                            </span>
                            <Link
                              href={newReportFor(e.equipment_id)}
                              className="shrink-0 rounded-lg border border-[#650d2f] px-2.5 py-1 text-xs font-semibold text-[#650d2f] hover:bg-[#650d2f] hover:text-white"
                            >
                              Report
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </>
            )}
          </Panel>

          <Panel
            title="My equipment requests"
            action={
              <Link href={ROUTES.equipmentRequests} className={styles.link}>
                See all
              </Link>
            }
          >
            {requests.error && requests.data === null ? (
              <ErrorBox
                title="Could not load your equipment requests"
                message={requests.error}
                onRetry={requests.retry}
              />
            ) : requests.data === null ? (
              <Skeleton rows={2} />
            ) : requests.data.length === 0 ? (
              <p className="rounded-xl bg-[#fbfaf7] px-4 py-4 text-sm text-gray-500">
                No equipment requested yet.{" "}
                <Link
                  href={ROUTES.newEquipmentRequest}
                  className="font-semibold text-[#650d2f] hover:underline"
                >
                  Request equipment
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {requests.data.slice(0, 4).map((r) => (
                  <li
                    key={r.request_id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#fbfaf7] px-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[#1c2434]">
                        {requestItemName(r)}
                      </span>
                      <span className="block text-sm text-gray-500">
                        {requestRef(r)}
                      </span>
                    </span>
                    <RequestChip label={equipmentRequestStatus(r)} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <AppShell active="home" title="">
      {(user) => <Content user={user} />}
    </AppShell>
  );
}
