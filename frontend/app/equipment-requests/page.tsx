"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { ErrorBox } from "@/components/requests/Feedback";
import { CurrentUser } from "@/lib/session";
import { ErrorBanner, Icon, RequestChip } from "@/components/waliin/ui";
import { splitJustification } from "@/lib/api/requests";
import {
  EquipmentRequest,
  ROUTES,
  equipmentRequestStatus,
  fetchMyEquipmentRequests,
  fmtDate,
  messageOf,
  requestItemName,
  requestRef,
} from "@/lib/waliin";

const STEPS = [
  {
    icon: "plus" as const,
    title: "You ask",
    text: "Say which machine your ward needs, why, and how many patients it would serve.",
  },
  {
    icon: "wrench" as const,
    title: "The engineer adds details",
    text: "Power and voltage, spare parts, service support and training, so it works here.",
  },
  {
    icon: "file" as const,
    title: "The manager sends it",
    text: "The health manager approves it and sends it to donors or suppliers.",
  },
  {
    icon: "check" as const,
    title: "You follow it",
    text: "See every step here until the machine is received.",
  },
];

const GROUPS: { label: string; match: string[]; tone: string }[] = [
  {
    label: "Waiting",
    match: ["Submitted", "Under review"],
    tone: "text-amber-600",
  },
  {
    label: "Needs more detail",
    match: ["More detail needed"],
    tone: "text-[#650d2f]",
  },
  {
    label: "Approved or sent",
    match: ["Approved", "Sent to donors"],
    tone: "text-sky-700",
  },
  {
    label: "Received",
    match: ["Received"],
    tone: "text-emerald-600",
  },
];

function Steps() {
  return (
    <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STEPS.map((step, index) => (
        <li
          key={step.title}
          className="rounded-2xl border border-[#e8b4c0] bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdf3d7] text-[#b07d00]">
              <Icon name={step.icon} size={18} />
            </span>
            <span className="text-sm font-bold text-gray-400">
              Step {index + 1}
            </span>
          </div>
          <p className="mt-3 font-bold text-[#1c2434]">{step.title}</p>
          <p className="mt-1 text-sm text-gray-500">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

function RequestCard({ request }: { request: EquipmentRequest }) {
  const [open, setOpen] = useState(false);
  const { reason, requirements } = splitJustification(
    request.justification ?? "",
  );
  const quantity = request.items?.[0]?.quantity_requested;

  return (
    <li className="rounded-2xl border border-[#e8b4c0] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8b4c0]/30 text-[#650d2f]">
          <Icon name="monitor" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-[#1c2434]">
            {requestItemName(request)}
            {quantity && quantity > 1 ? ` × ${quantity}` : ""}
          </p>
          <p className="text-sm text-gray-500">
            {requestRef(request)}
            {request.requested_at
              ? ` · Asked on ${fmtDate(request.requested_at)}`
              : ""}
          </p>
        </div>
        <RequestChip label={equipmentRequestStatus(request)} />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="text-sm font-semibold text-[#650d2f] hover:underline"
        >
          {open ? "Hide details" : "Details"}
        </button>
      </div>

      {request.decision_reason && (
        <p className="mt-4 rounded-xl bg-[#e8b4c0]/20 px-4 py-3 text-sm text-[#650d2f]">
          <span className="font-semibold">Note from the health manager: </span>
          {request.decision_reason}
        </p>
      )}

      {open && (
        <div className="mt-4 grid gap-4 rounded-xl bg-[#fbfaf7] p-4 text-sm text-gray-700 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">
              Why your ward needs it
            </p>
            <p className="mt-1 whitespace-pre-line">{reason || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">
              Technical requirements from the engineer
            </p>
            <p className="mt-1 whitespace-pre-line">
              {requirements || "The engineer has not added them yet."}
            </p>
          </div>
        </div>
      )}
    </li>
  );
}

function Content({ user }: { user: CurrentUser }) {
  const [rows, setRows] = useState<EquipmentRequest[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchMyEquipmentRequests(user.user_id)
      .then((list) => {
        if (!alive) return;
        setRows(list);
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
  }, [user.user_id, attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  const counts = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        value: rows
          ? rows.filter((r) => group.match.includes(equipmentRequestStatus(r)))
              .length
          : null,
      })),
    [rows],
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-2xl text-base text-gray-500">
          Machines your ward needs but does not have. Follow each request until
          the machine is received.
        </p>
        <Link
          href={ROUTES.newEquipmentRequest}
          className="inline-flex items-center gap-2 rounded-xl bg-[#650d2f] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#4e0a25]"
        >
          <Icon name="plus" size={16} /> Request equipment
        </Link>
      </div>

      {error && rows === null ? (
        <ErrorBox
          title="Could not load your equipment requests"
          message={error}
          onRetry={retry}
        />
      ) : rows === null ? (
        <div role="status" aria-label="Loading" className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : (
        <>
          {error && (
            <ErrorBanner
              message="Could not refresh your equipment requests."
              onRetry={retry}
              busy={loading}
              kept
            />
          )}

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {counts.map((count) => (
              <div
                key={count.label}
                className="rounded-2xl border border-[#e8b4c0] bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-semibold text-[#1c2434]">
                  {count.label}
                </p>
                <p className={`mt-2 text-4xl font-extrabold ${count.tone}`}>
                  {count.value ?? "—"}
                </p>
              </div>
            ))}
          </div>

          {rows.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-[#e8b4c0] bg-white p-8">
              <div className="mb-6 flex flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e8b4c0]/40 text-[#650d2f]">
                  <Icon name="monitor" size={24} />
                </span>
                <h2 className="mt-3 text-xl font-bold text-[#650d2f]">
                  Your ward has not asked for equipment yet
                </h2>
                <p className="mt-1 max-w-xl text-sm text-gray-500">
                  If patients wait or are referred because a machine is missing,
                  request it here. This is how a request travels:
                </p>
              </div>
              <Steps />
            </section>
          ) : (
            <ul className="flex flex-col gap-4">
              {rows.map((r) => (
                <RequestCard key={r.request_id} request={r} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default function EquipmentRequestsPage() {
  return (
    <AppShell active="equipment" title="Equipment requests">
      {(user) => <Content user={user} />}
    </AppShell>
  );
}
