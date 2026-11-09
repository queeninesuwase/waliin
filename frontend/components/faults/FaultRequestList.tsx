"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getDepartments } from "@/lib/api/equipment";
import {
  buildFaultRows,
  CLOSED_STATUSES,
  getAllFaults,
  getFaultEquipment,
  getPriorityList,
  type FaultEquipment,
  type FaultRow,
} from "@/lib/api/faults";
import { errorMessage } from "@/lib/api/maintenance";

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function priorityStyle(priority: string | null) {
  switch ((priority ?? "").toLowerCase()) {
    case "critical":
      return "bg-red-100 text-red-700";
    case "high":
      return "bg-orange-100 text-orange-700";
    case "medium":
      return "bg-yellow-100 text-yellow-700";
    case "low":
      return "bg-green-100 text-green-700";
    default:
      return "bg-[#e8b4c0]/40 text-[#650d2f]";
  }
}

async function loadRows() {
  const [faults, priority, departments] = await Promise.all([
    getAllFaults(),
    getPriorityList(),
    getDepartments().catch(() => []),
  ]);

  const equipmentIds = [...new Set(faults.map((fault) => fault.equipment_id))];
  const equipment = new Map<string, FaultEquipment | null>(
    await Promise.all(
      equipmentIds.map(
        async (equipmentId) =>
          [
            equipmentId,
            await getFaultEquipment(equipmentId).catch(() => null),
          ] as const,
      ),
    ),
  );
  const departmentNames = new Map(
    departments.map((department) => [
      department.department_id,
      department.department_name,
    ]),
  );

  return buildFaultRows(faults, priority, equipment, departmentNames);
}

export default function FaultRequestList() {
  const [faults, setFaults] = useState<FaultRow[]>([]);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    loadRows()
      .then((rows) => {
        if (cancelled) return;
        setFaults(rows);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(errorMessage(err, "Could not load fault requests."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setLoading(true);
    setError("");
    setAttempt((count) => count + 1);
  }

  const counts = useMemo(
    () => ({
      waiting: faults.filter(
        (fault) => !fault.assessed && !CLOSED_STATUSES.has(fault.status),
      ).length,
      open: faults.filter((fault) => !CLOSED_STATUSES.has(fault.status)).length,
    }),
    [faults],
  );

  const filteredFaults = useMemo(() => {
    const query = search.trim().toLowerCase();

    return faults.filter((fault) => {
      const matchesSearch =
        query === "" ||
        fault.equipmentName.toLowerCase().includes(query) ||
        fault.assetTag.toLowerCase().includes(query) ||
        fault.department.toLowerCase().includes(query) ||
        fault.description.toLowerCase().includes(query);

      const matchesPriority =
        priority === "all" ||
        (priority === "unassessed"
          ? !fault.assessed
          : fault.priorityLevel?.toLowerCase() === priority);

      const closed = CLOSED_STATUSES.has(fault.status);
      const matchesStatus =
        status === "all" ||
        (status === "open" && !closed) ||
        fault.status.toLowerCase() === status;

      return matchesSearch && matchesPriority && matchesStatus;
    });
  }, [faults, priority, search, status]);

  return (
    <>
      {!loading && !error && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <button
            type="button"
            onClick={() => {
              setPriority("unassessed");
              setStatus("open");
            }}
            className="rounded-[8px] border border-[#e4b6c3] bg-white px-4 py-3 text-left transition hover:border-[#650d2f]"
          >
            <p className="text-[12px] text-[#7b8796]">Waiting for assessment</p>
            <p className="mt-1 text-2xl font-bold text-[#650d2f]">
              {counts.waiting}
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setPriority("all");
              setStatus("open");
            }}
            className="rounded-[8px] border border-[#e4b6c3] bg-white px-4 py-3 text-left transition hover:border-[#650d2f]"
          >
            <p className="text-[12px] text-[#7b8796]">Open faults</p>
            <p className="mt-1 text-2xl font-bold text-[#263346]">
              {counts.open}
            </p>
          </button>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search equipment, asset tag, department or problem"
          className="h-[46px] w-full max-w-[480px] rounded-[7px] border border-[#e4b6c3] bg-white px-4 text-[14px] text-[#263346] outline-none placeholder:text-[#7b8796]"
        />

        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          aria-label="Priority"
          className="h-[46px] min-w-[180px] rounded-[7px] border border-[#e4b6c3] bg-white px-4 text-[14px] text-[#263346] outline-none"
        >
          <option value="all">All priorities</option>
          <option value="unassessed">Needs assessment</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Status"
          className="h-[46px] min-w-[180px] rounded-[7px] border border-[#e4b6c3] bg-white px-4 text-[14px] text-[#263346] outline-none"
        >
          <option value="open">Open faults</option>
          <option value="all">All faults</option>
          <option value="reported">Reported</option>
          <option value="assigned">Assigned</option>
          <option value="under_inspection">Under inspection</option>
          <option value="awaiting_resources">Awaiting resources</option>
          <option value="under_repair">Under repair</option>
          <option value="awaiting_verification">Awaiting verification</option>
          <option value="verified">Verified</option>
          <option value="closed">Back in use</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-[#e4b6c3] bg-white">
        {loading ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-[#263346]">
              Loading fault requests...
            </p>
          </div>
        ) : error ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-[#76072f]">{error}</p>

            <button
              type="button"
              onClick={retry}
              className="mt-4 rounded-[7px] bg-[#76072f] px-5 py-2 text-[13px] font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : filteredFaults.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-[14px] font-semibold text-[#263346]">
              No fault requests found
            </p>

            <p className="mt-2 text-[12px] text-[#7b8796]">
              {faults.length === 0
                ? "Faults reported by clinical staff will show here."
                : "Try changing your search or filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              <div className="grid grid-cols-[1.6fr_0.9fr_1fr_0.9fr_1fr_0.9fr_0.7fr] bg-[#e4b6c3] px-5 py-3 text-[12px] font-semibold text-[#5a3040]">
                <span>Equipment</span>
                <span>Asset tag</span>
                <span>Department</span>
                <span>Reported</span>
                <span>Status</span>
                <span>Priority</span>
                <span>Action</span>
              </div>

              {filteredFaults.map((fault) => (
                <div
                  key={fault.faultId}
                  className="grid grid-cols-[1.6fr_0.9fr_1fr_0.9fr_1fr_0.9fr_0.7fr] items-center border-t border-[#f1e5e8] px-5 py-4 text-[13px] text-[#263346]"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate font-semibold">
                      {fault.equipmentName}
                    </p>

                    <p className="mt-1 truncate text-[11px] text-[#7b8796]">
                      {fault.description}
                    </p>
                  </div>

                  <span>{fault.assetTag || "—"}</span>

                  <span>{fault.department || "—"}</span>

                  <span>{formatDate(fault.reportedAt)}</span>

                  <span>
                    {fault.status === "closed"
                      ? "Back in use"
                      : formatLabel(fault.status)}
                  </span>

                  <span>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${priorityStyle(
                        fault.priorityLevel,
                      )}`}
                    >
                      {fault.priorityLevel
                        ? formatLabel(fault.priorityLevel)
                        : CLOSED_STATUSES.has(fault.status)
                          ? "Done"
                          : "Needs assessment"}
                    </span>
                  </span>

                  <span>
                    <Link
                      href={`/biomedical-engineer/faults/${fault.faultId}`}
                      className="font-semibold text-[#76072f] hover:underline"
                    >
                      {fault.assessed || CLOSED_STATUSES.has(fault.status)
                        ? "View"
                        : "Assess"}
                    </Link>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
