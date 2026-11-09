"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Card,
  LevelBadge,
  LoadError,
  Skeleton,
} from "@/components/maintenance/ui";
import { useUserProfile } from "@/components/providers/UserProfileProvider";
import { getMyEquipment, type EquipmentResponse } from "@/lib/api/equipment";
import {
  CLOSED_STATUSES,
  getAllFaults,
  getFaultEquipment,
  getPriorityList,
  equipmentName,
  type FaultEquipment,
  type FaultRecord,
  type PriorityListItem,
} from "@/lib/api/faults";
import { errorMessage, levelOf } from "@/lib/api/maintenance";
import { greeting } from "@/lib/session";

type DashboardData = {
  equipment: EquipmentResponse[];
  priority: PriorityListItem[];
  waiting: { fault: FaultRecord; equipment: FaultEquipment | null }[];
  waitingTotal: number;
  backInUse: number;
};

async function loadDashboard(): Promise<DashboardData> {
  const [equipment, faults, priority] = await Promise.all([
    getMyEquipment(),
    getAllFaults(),
    getPriorityList(),
  ]);
  const ranked = new Set(priority.map((item) => item.fault_id));
  const open = faults.filter(
    (fault) =>
      !CLOSED_STATUSES.has(fault.status) && !ranked.has(fault.fault_id),
  );
  const newest = [...open]
    .sort((a, b) => Date.parse(b.reported_at) - Date.parse(a.reported_at))
    .slice(0, 5);
  const waiting = await Promise.all(
    newest.map(async (fault) => ({
      fault,
      equipment: await getFaultEquipment(fault.equipment_id).catch(() => null),
    })),
  );
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const backInUse = faults.filter(
    (fault) =>
      fault.status === "closed" &&
      fault.closed_at !== null &&
      Date.parse(fault.closed_at) >= monthStart.getTime(),
  ).length;

  return {
    equipment,
    priority,
    waiting,
    waitingTotal: open.length,
    backInUse,
  };
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export default function BiomedicalEngineerDashboard() {
  const { user } = useUserProfile();
  const displayName =
    user?.full_name?.trim().split(" ")[0] || user?.email || "there";
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadDashboard().then(
      (result) => {
        if (!active) return;
        setData(result);
        setError("");
      },
      (err: unknown) => {
        if (active)
          setError(errorMessage(err, "Could not load your dashboard."));
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const urgent = data
    ? data.priority.filter(
        (item) =>
          item.priority_level === "critical" || item.priority_level === "high",
      ).length
    : null;
  const returned = data
    ? data.equipment.filter(
        (item) => item.registration_status.toLowerCase() === "returned",
      )
    : [];
  const pending = data
    ? data.equipment.filter(
        (item) => item.registration_status.toLowerCase() === "pending",
      ).length
    : 0;

  const cards = [
    {
      title: "My equipment",
      value: data?.equipment.length,
      note: `${pending} waiting for approval`,
      href: "/biomedical-engineer/equipment",
    },
    {
      title: "Waiting for assessment",
      value: data?.waitingTotal,
      note: "New fault reports",
      href: "/biomedical-engineer/faults",
    },
    {
      title: "Critical and high",
      value: urgent ?? undefined,
      note: "Fix these first",
      href: "/biomedical-engineer/maintenance",
    },
    {
      title: "Back in use this month",
      value: data?.backInUse,
      note: "Passed tests and closed",
      href: "/biomedical-engineer/reports",
    },
  ];

  return (
    <div className="min-h-full bg-[#F8F6F3] px-4 py-6 text-[#263449] md:px-8 md:py-8 lg:px-10">
      <div className="flex w-full flex-col gap-6">
        <header>
          <h1
            suppressHydrationWarning
            className="text-3xl font-bold tracking-tight text-[#650d2f]"
          >
            {greeting()}, {displayName}
          </h1>
          <p className="mt-1 text-sm text-gray-500 md:text-base">
            Here is what needs your attention today.
          </p>
        </header>

        {error && !data ? (
          <LoadError
            message={error}
            onRetry={() => {
              setError("");
              setAttempt((count) => count + 1);
            }}
          />
        ) : (
          <>
            <section
              aria-label="Dashboard summary"
              className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4"
            >
              {cards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="rounded-xl border border-[#e8b4c0] bg-white p-4 transition hover:border-[#650d2f] hover:shadow-sm focus:ring-2 focus:ring-[#d9a00a] focus:outline-none md:p-5"
                >
                  <p className="text-sm font-medium text-gray-600">
                    {card.title}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#650d2f]">
                    {card.value ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{card.note}</p>
                </Link>
              ))}
            </section>

            {!data ? (
              <Skeleton rows={3} />
            ) : (
              <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-2">
                <Card className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-[#650d2f]">
                      Fix these first
                    </h2>
                    <Link
                      href="/biomedical-engineer/maintenance"
                      className="text-sm font-semibold text-[#650d2f] hover:underline"
                    >
                      Open maintenance
                    </Link>
                  </div>
                  {data.priority.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500">
                      Nothing on the priority list. Assess new fault reports to
                      rank them.
                    </p>
                  ) : (
                    <ul className="mt-4 flex flex-col divide-y divide-[#f1e5e8]">
                      {data.priority.slice(0, 5).map((item) => (
                        <li
                          key={item.fault_id}
                          className="flex items-center justify-between gap-3 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {item.equipment_name}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {item.asset_tag} · {item.department_name}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <LevelBadge level={levelOf(item.priority_level)} />
                            <Link
                              href={`/biomedical-engineer/faults/${item.fault_id}`}
                              className="text-sm font-semibold text-[#650d2f] hover:underline"
                            >
                              View
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-[#650d2f]">
                      New fault reports
                    </h2>
                    <Link
                      href="/biomedical-engineer/faults"
                      className="text-sm font-semibold text-[#650d2f] hover:underline"
                    >
                      See all
                    </Link>
                  </div>
                  {data.waiting.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500">
                      No new reports. Every open fault has been assessed.
                    </p>
                  ) : (
                    <ul className="mt-4 flex flex-col divide-y divide-[#f1e5e8]">
                      {data.waiting.map(({ fault, equipment }) => (
                        <li
                          key={fault.fault_id}
                          className="flex items-center justify-between gap-3 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {equipmentName(equipment)}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {fault.description} ·{" "}
                              {shortDate(fault.reported_at)}
                            </p>
                          </div>
                          <Link
                            href={`/biomedical-engineer/faults/${fault.fault_id}`}
                            className="shrink-0 rounded-lg bg-[#650d2f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e0a25]"
                          >
                            Assess
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                {returned.length > 0 && (
                  <Card className="xl:col-span-2">
                    <h2 className="text-lg font-bold text-[#650d2f]">
                      Registrations returned by the manager
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Fix the details and resubmit them for approval.
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {returned.map((item) => (
                        <li key={item.equipment_id}>
                          <Link
                            href="/biomedical-engineer/equipment/list?status=returned"
                            className="inline-flex rounded-full bg-[#e8b4c0]/30 px-3 py-1.5 text-sm font-semibold text-[#650d2f] hover:bg-[#e8b4c0]/50"
                          >
                            {item.asset_tag} · {item.model_name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
