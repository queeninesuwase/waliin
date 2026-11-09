"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import AssessmentHistory from "@/components/assessment/AssessmentHistory";
import AssessmentPanel from "@/components/assessment/AssessmentPanel";
import {
  Card,
  LevelBadge,
  LoadError,
  PageTitle,
  Skeleton,
} from "@/components/maintenance/ui";
import WorkPanel from "@/components/maintenance/WorkPanel";
import { useUserProfile } from "@/components/providers/UserProfileProvider";
import { getDepartments } from "@/lib/api/equipment";
import {
  checkResourceRequest,
  CLOSED_STATUSES,
  createResourceRequest,
  equipmentName,
  getFault,
  getFaultEquipment,
  getPriorityList,
  markOutOfService,
  REQUEST_TYPES,
  setFaultStatus,
  type FaultEquipment,
  type FaultRecord,
  type PriorityListItem,
  type RequestType,
} from "@/lib/api/faults";
import {
  ensureAssigned,
  errorMessage,
  getFaultRecords,
  levelOf,
  statusLabel,
  TEST_TYPES,
  type RepairRecord,
} from "@/lib/api/maintenance";

type Detail = {
  fault: FaultRecord;
  equipment: FaultEquipment | null;
  department: string;
  priority: PriorityListItem | null;
  records: RepairRecord[];
};

const FIELD =
  "w-full rounded-lg border border-[#e8b4c0] bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-[#650d2f] focus:outline-none";

function when(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function faultStatusLabel(status: string) {
  return status === "closed" ? "Back in use" : statusLabel(status);
}

async function loadDetail(faultId: string): Promise<Detail> {
  const fault = await getFault(faultId);
  const [equipment, departments, priority, records] = await Promise.all([
    getFaultEquipment(fault.equipment_id).catch(() => null),
    getDepartments().catch(() => []),
    getPriorityList().catch(() => []),
    getFaultRecords(faultId).catch(() => []),
  ]);
  const department =
    departments.find((item) => item.department_id === equipment?.department_id)
      ?.department_name ??
    priority.find((item) => item.equipment_id === fault.equipment_id)
      ?.department_name ??
    "";
  return {
    fault,
    equipment,
    department,
    priority: priority.find((item) => item.fault_id === faultId) ?? null,
    records,
  };
}

function timeline(detail: Detail) {
  const items: { at: string; title: string; text?: string | null }[] = [
    {
      at: detail.fault.reported_at,
      title: "Fault reported",
      text: detail.fault.description,
    },
  ];
  for (const record of detail.records) {
    const test = TEST_TYPES.find((item) => item.value === record.record_type);
    items.push({
      at: record.performed_at,
      title:
        record.record_type === "release" || record.released_at
          ? "Released for use"
          : record.record_type === "repair"
            ? "Repair logged"
            : `${test ? test.label : statusLabel(record.record_type)} ${
                record.test_result === "pass" ? "passed" : "failed"
              }`,
      text: record.work_performed ?? record.test_details,
    });
  }
  if (detail.fault.closed_at) {
    items.push({ at: detail.fault.closed_at, title: "Back in use" });
  }
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

function RequestForm({
  faultId,
  engineerId,
  onSent,
}: {
  faultId: string;
  engineerId: string;
  onSent: (message: string) => void;
}) {
  const [type, setType] = useState<RequestType>("spare_parts");
  const [item, setItem] = useState("");
  const [specs, setSpecs] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = {
      request_type: type,
      justification: why.trim(),
      related_fault_id: faultId,
      items: [
        {
          item_name_or_service: item.trim(),
          technical_specifications: specs.trim() || null,
          quantity_requested: Number(quantity),
        },
      ],
    };
    const problem = checkResourceRequest(input);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const request = await createResourceRequest(engineerId, input);
      const label = request.request_number
        ? `Request ${request.request_number}`
        : "Your request";
      try {
        await ensureAssigned(faultId, engineerId);
        await setFaultStatus(
          faultId,
          "awaiting_resources",
          engineerId,
          `${label} sent`,
        );
      } catch {
        setError("");
      }
      onSent(`${label} was sent to the health manager for approval.`);
    } catch (err) {
      setError(errorMessage(err, "Could not send the request. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
        What do you need?
        <select
          value={type}
          onChange={(event) => setType(event.target.value as RequestType)}
          className={FIELD}
        >
          {REQUEST_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
          Part, service or machine
          <input
            value={item}
            onChange={(event) => setItem(event.target.value)}
            placeholder="For example: SpO2 extension cable"
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
          Quantity
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className={FIELD}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
        Part number or technical details{" "}
        <span className="font-normal text-gray-500">(optional)</span>
        <input
          value={specs}
          onChange={(event) => setSpecs(event.target.value)}
          placeholder="For example: 220 V, 50 Hz, compatible with BeneVision N12"
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
        Why is it needed?
        <textarea
          rows={3}
          value={why}
          onChange={(event) => setWhy(event.target.value)}
          placeholder="For example: the cable is broken and the monitor cannot read SpO2."
          className={FIELD}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-11 rounded-lg bg-[#650d2f] text-sm font-semibold text-white hover:bg-[#4e0a25] disabled:opacity-60"
      >
        {busy ? "Sending..." : "Send to manager"}
      </button>
    </form>
  );
}

export default function FaultDetail({ faultId }: { faultId: string }) {
  const { user, loading: userLoading } = useUserProfile();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [working, setWorking] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    loadDetail(faultId).then(
      (data) => {
        if (!active) return;
        setDetail(data);
        setError("");
      },
      (err: unknown) => {
        if (active)
          setError(errorMessage(err, "Could not load this fault. Try again."));
      },
    );
    return () => {
      active = false;
    };
  }, [faultId, attempt]);

  function reload() {
    setAttempt((count) => count + 1);
  }

  async function assignToMe() {
    if (!user) return;
    setBusy(true);
    setNotice("");
    try {
      await ensureAssigned(faultId, user.user_id);
      setNotice("This fault is now assigned to you.");
      reload();
    } catch (err) {
      setNotice(errorMessage(err, "Could not assign this fault. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function takeOutOfService() {
    if (!user || !detail) return;
    setBusy(true);
    setNotice("");
    try {
      await markOutOfService(faultId, user.user_id, detail.fault.status);
      setNotice(
        "Marked out of service. The downtime clock has started and stops when the machine is back in use.",
      );
      reload();
    } catch (err) {
      setNotice(
        errorMessage(err, "Could not mark the machine out of service."),
      );
    } finally {
      setBusy(false);
    }
  }

  if (error && !detail) {
    return (
      <div className="min-h-full bg-[#F8F6F3] px-4 py-6 md:px-8 md:py-8 lg:px-10">
        <LoadError
          message={error}
          onRetry={() => {
            setError("");
            reload();
          }}
        />
      </div>
    );
  }

  if (!detail || userLoading) {
    return (
      <div className="min-h-full bg-[#F8F6F3] px-4 py-6 md:px-8 md:py-8 lg:px-10">
        <Skeleton rows={4} />
      </div>
    );
  }

  const { fault, equipment, priority } = detail;
  const name = priority?.equipment_name ?? equipmentName(equipment);
  const open = !CLOSED_STATUSES.has(fault.status);
  const engineerId = user?.user_id ?? "";
  const assignedLabel = !fault.assigned_engineer_id
    ? "Not assigned yet"
    : fault.assigned_engineer_id === engineerId
      ? "You"
      : "Another engineer";

  return (
    <div className="min-h-full bg-[#F8F6F3] px-4 py-6 text-[#263449] md:px-8 md:py-8 lg:px-10">
      <div className="flex w-full flex-col gap-6">
        <Link
          href="/biomedical-engineer/faults"
          className="w-fit text-sm font-semibold text-[#650d2f] hover:underline"
        >
          ← Back to faults
        </Link>

        <PageTitle
          title={name}
          subtitle={[
            equipment?.asset_tag ?? priority?.asset_tag,
            detail.department || priority?.department_name,
            equipment?.location,
          ]
            .filter(Boolean)
            .join(" · ")}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#650d2f] ring-1 ring-[#e8b4c0]">
                {faultStatusLabel(fault.status)}
              </span>
              {priority ? (
                <LevelBadge level={levelOf(priority.priority_level)} />
              ) : (
                open && (
                  <span className="rounded-full bg-[#e8b4c0]/40 px-3 py-1 text-xs font-semibold text-[#650d2f]">
                    Needs assessment
                  </span>
                )
              )}
            </div>
          }
        />

        {notice && (
          <div
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {notice}
          </div>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <h2 className="text-lg font-bold text-[#650d2f]">The problem</h2>
              <p className="mt-2 text-sm leading-6 whitespace-pre-line text-gray-700">
                {fault.description}
              </p>
              <dl className="mt-5 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-gray-500">Reported</dt>
                  <dd className="mt-0.5 font-medium">
                    {when(fault.reported_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">
                    Severity given by reporter
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {statusLabel(fault.severity)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Assigned engineer</dt>
                  <dd className="mt-0.5 font-medium">{assignedLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">
                    Out of service since
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {fault.out_of_service_at
                      ? when(fault.out_of_service_at)
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Category</dt>
                  <dd className="mt-0.5 font-medium">
                    {equipment?.equipment_category ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Source</dt>
                  <dd className="mt-0.5 font-medium">
                    {equipment ? statusLabel(equipment.acquisition_type) : "—"}
                  </dd>
                </div>
                {priority && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-gray-500">Why this priority</dt>
                    <dd className="mt-0.5 font-medium">
                      {priority.priority_explanation} (score{" "}
                      {priority.priority_score})
                    </dd>
                  </div>
                )}
              </dl>

              {open && (
                <div className="mt-6 flex flex-wrap gap-3">
                  {!fault.out_of_service_at && (
                    <button
                      type="button"
                      onClick={takeOutOfService}
                      disabled={busy || !engineerId}
                      className="h-11 rounded-lg border border-red-300 bg-red-50 px-5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      Mark out of service
                    </button>
                  )}
                  {!fault.assigned_engineer_id && (
                    <button
                      type="button"
                      onClick={assignToMe}
                      disabled={busy || !engineerId}
                      className="h-11 rounded-lg border border-[#650d2f] bg-white px-5 text-sm font-semibold text-[#650d2f] hover:bg-[#e8b4c0]/20 disabled:opacity-60"
                    >
                      {busy ? "Assigning..." : "Assign to me"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setWorking(true)}
                    disabled={!engineerId}
                    className="h-11 rounded-lg bg-[#650d2f] px-5 text-sm font-semibold text-white hover:bg-[#4e0a25] disabled:opacity-60"
                  >
                    Repair and test
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequesting((value) => !value)}
                    disabled={!engineerId}
                    className="h-11 rounded-lg bg-[#d9a00a] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {requesting ? "Hide request form" : "Request parts or help"}
                  </button>
                </div>
              )}
            </Card>

            {open && requesting && engineerId && (
              <Card>
                <h2 className="text-lg font-bold text-[#650d2f]">
                  Request parts, outside help or a replacement
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  The health manager approves it and sends it to the donor or
                  supplier.
                </p>
                <RequestForm
                  faultId={faultId}
                  engineerId={engineerId}
                  onSent={(message) => {
                    setRequesting(false);
                    setNotice(message);
                    reload();
                  }}
                />
              </Card>
            )}

            {engineerId &&
              (open ? (
                <AssessmentPanel
                  faultId={faultId}
                  engineerId={engineerId}
                  onSaved={reload}
                />
              ) : (
                <AssessmentHistory faultId={faultId} engineerId={engineerId} />
              ))}
          </div>

          <Card className="self-start">
            <h2 className="text-lg font-bold text-[#650d2f]">Timeline</h2>
            <ol className="mt-4 flex flex-col gap-4 border-l-2 border-[#e8b4c0] pl-4">
              {timeline(detail).map((item, index) => (
                <li key={`${item.at}-${index}`} className="relative">
                  <span className="absolute top-1.5 -left-[23px] h-3 w-3 rounded-full bg-[#650d2f] ring-2 ring-white" />
                  <p className="text-sm font-semibold text-gray-900">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-500">{when(item.at)}</p>
                  {item.text && (
                    <p className="mt-1 text-sm text-gray-700">{item.text}</p>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {working && engineerId && (
        <WorkPanel
          target={{
            faultId,
            equipmentName: name,
            assetTag: equipment?.asset_tag ?? priority?.asset_tag ?? "",
            department: detail.department || priority?.department_name || "",
            status: fault.status,
          }}
          engineerId={engineerId}
          onClose={() => {
            setWorking(false);
            reload();
          }}
          onReleased={() => {
            setWorking(false);
            setNotice("The machine is back in use and the fault is closed.");
            reload();
          }}
        />
      )}
    </div>
  );
}
