"use client";

import { useEffect, useMemo, useState } from "react";

import {
  listAllEquipment,
  approveEquipment,
  returnEquipment,
  type Equipment as ApiEquipment,
} from "@/features/equipment/api";
import { listDepartments } from "@/features/departments/api";
import { listUsers } from "@/features/users/api";
import type { Department } from "@/features/departments/api";
import type { ManagedUser } from "@/features/users/api";

type EquipmentStatus = "Pending approval" | "Approved" | "Returned";

type Equipment = ApiEquipment & {
  name: string;
  department: string;
  facility: string;
  submittedBy: string;
  submittedOn: string;
  status: EquipmentStatus;
};

const tabs = [
  { label: "All equipment", value: "All" },
  { label: "Pending approvals", value: "Pending approval" },
  { label: "Approved", value: "Approved" },
] as const;

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [facility, setFacility] = useState("All facilities");
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [comments, setComments] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadEquipment() {
      try {
        const [records, departments, users] = await Promise.all([
          listAllEquipment(),
          listDepartments(),
          listUsers(),
        ]);

        if (!active) return;

        const departmentNames = new Map(
          departments.map((department: Department) => [
            department.department_id,
            department.department_name,
          ]),
        );

        const userNames = new Map(
          users.map((user: ManagedUser) => [
            user.user_id,
            user.full_name || user.email,
          ]),
        );

        const statusNames: Record<string, EquipmentStatus> = {
          pending: "Pending approval",
          approved: "Approved",
          returned: "Returned",
        };

        setEquipment(
          records.map((record: ApiEquipment) => ({
            ...record,
            name: record.model_name,
            department:
              departmentNames.get(record.department_id) ?? "Unknown department",
            facility: record.location,
            submittedBy: userNames.get(record.registered_by) ?? "Unknown user",
            submittedOn: new Date(record.created_at).toLocaleDateString(),
            status:
              statusNames[record.registration_status] ??
              (() => {
                throw new Error(
                  `Unknown equipment registration status: ${record.registration_status}`,
                );
              })(),
          })),
        );
      } catch (error) {
        if (active) {
          setNotice(
            error instanceof Error
              ? error.message
              : "Unable to load equipment.",
          );
        }
      }
    }

    void loadEquipment();

    return () => {
      active = false;
    };
  }, []);

  const facilities: string[] = [
    "All facilities",
    ...Array.from(new Set(equipment.map((item) => item.facility))),
  ];

  const counts = useMemo(
    () => ({
      All: equipment.length,
      "Pending approval": equipment.filter(
        (item) => item.status === "Pending approval",
      ).length,
      Approved: equipment.filter((item) => item.status === "Approved").length,
      Returned: equipment.filter((item) => item.status === "Returned").length,
    }),
    [equipment],
  );

  const filteredEquipment = equipment.filter((item) => {
    const matchesTab = activeTab === "All" || item.status === activeTab;
    const matchesFacility =
      facility === "All facilities" || item.facility === facility;
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      [
        item.name,
        item.manufacturer,
        item.asset_tag,
        item.submittedBy,
        item.department,
      ].some((value) => value.toLowerCase().includes(query));

    return matchesTab && matchesFacility && matchesSearch;
  });

  async function updateStatus(status: EquipmentStatus) {
    if (!selected) return;

    if (status === "Returned" && !comments.trim()) {
      setNotice("Please enter a reason before returning this equipment.");
      return;
    }

    try {
      const updated =
        status === "Approved"
          ? await approveEquipment(selected.equipment_id)
          : await returnEquipment(selected.equipment_id, {
              reason: comments.trim(),
            });

      setEquipment((current) =>
        current.map((item) =>
          item.equipment_id === updated.equipment_id
            ? { ...item, ...updated, status }
            : item,
        ),
      );

      setNotice(
        status === "Approved"
          ? "Equipment approved successfully."
          : "Equipment returned for correction.",
      );
      setSelected(null);
      setComments("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The action failed. Please try again.",
      );
    }
  }

  function openReview(item: Equipment) {
    setSelected(item);
    setComments("");
    setNotice("");
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-brand">
            Equipment
          </h1>
          <p className="mt-2 text-base text-gray-500">
            Review registrations and track equipment updates.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-base text-gray-600">
          <span className="text-gold">●</span>
          Equipment management
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg border border-rose bg-white px-4 py-3 text-base text-brand"
        >
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
            className="font-bold"
          >
            ×
          </button>
        </div>
      )}

      <div className="border-b border-gray-200">
        <div className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((tab) => {
            const active = activeTab === tab.value;
            const count = counts[tab.value as keyof typeof counts];

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-1 pb-4 text-base font-medium transition ${
                  active
                    ? "border-brand text-brand"
                    : "border-transparent text-gray-500 hover:text-brand"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-sm ${
                    active
                      ? "bg-brand/10 text-brand"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex h-12 flex-1 items-center gap-3 rounded-lg border border-gray-200 bg-white px-4">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-5 w-5 text-gray-400"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search equipment, asset tag, or submitter..."
            className="w-full bg-transparent text-base outline-none placeholder:text-gray-400"
            aria-label="Search equipment"
          />
        </div>

        <select
          value={facility}
          onChange={(event) => setFacility(event.target.value)}
          className="h-12 rounded-lg border border-gray-200 bg-white px-4 text-base text-gray-700 outline-none focus:border-brand"
          aria-label="Filter by facility"
        >
          {facilities.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col justify-between gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-gray-900">
              Equipment registrations
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Review and manage submitted equipment.
            </p>
          </div>
          <span className="text-base text-gray-500">
            {filteredEquipment.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-rose/30">
              <tr className="text-sm font-semibold tracking-wide text-brand">
                <th className="px-5 py-4">Equipment</th>
                <th className="px-4 py-4">Asset tag</th>
                <th className="px-4 py-4">Department</th>
                <th className="px-4 py-4">Submitted by</th>
                <th className="px-4 py-4">Submitted on</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredEquipment.map((item) => (
                <tr
                  key={item.equipment_id}
                  className="transition hover:bg-cream"
                >
                  <td className="px-5 py-4">
                    <p className="text-base font-semibold text-gray-900">
                      {item.name}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {item.manufacturer}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-base text-gray-600">
                    {item.asset_tag}
                  </td>
                  <td className="px-4 py-4 text-base text-gray-600">
                    {item.department}
                  </td>
                  <td className="px-4 py-4 text-base text-gray-600">
                    {item.submittedBy}
                  </td>
                  <td className="px-4 py-4 text-base text-gray-600">
                    {item.submittedOn}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => openReview(item)}
                      className="rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}

              {filteredEquipment.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-14 text-center text-base text-gray-500"
                  >
                    No equipment matches your search or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <button
            type="button"
            aria-label="Close review panel"
            onClick={() => setSelected(null)}
            className="absolute inset-0 cursor-default"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
            className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2 id="review-title" className="text-xl font-bold text-brand">
                  Review equipment
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Registration details and approval
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg px-3 py-2 text-xl text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="flex-1 space-y-6 p-6">
              <div>
                <StatusBadge status={selected.status} />
                <h3 className="mt-3 text-lg font-semibold text-gray-900">
                  {selected.name}
                </h3>
                <p className="text-base text-gray-500">
                  {selected.manufacturer}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Detail label="Asset tag" value={selected.asset_tag} />
                <Detail label="Department" value={selected.department} />
                <Detail label="Facility" value={selected.facility} />
                <Detail label="Submitted by" value={selected.submittedBy} />
                <Detail label="Submitted on" value={selected.submittedOn} />
              </div>

              <div className="border-t border-gray-100 pt-5">
                <label
                  htmlFor="review-comments"
                  className="mb-2 block text-base font-semibold text-gray-800"
                >
                  Review comments
                </label>
                <textarea
                  id="review-comments"
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                  rows={5}
                  placeholder="Add feedback or explain what needs correction..."
                  className="w-full resize-none rounded-lg border border-gray-200 p-3 text-base outline-none focus:border-brand"
                />
                <p className="mt-2 text-sm text-gray-400">
                  A comment is required when returning equipment.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 p-6 sm:flex-row">
              <button
                type="button"
                onClick={() => updateStatus("Returned")}
                className="flex-1 rounded-lg border border-brand px-4 py-3 text-base font-semibold text-brand hover:bg-brand/5"
              >
                Return for correction
              </button>
              <button
                type="button"
                onClick={() => updateStatus("Approved")}
                className="flex-1 rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white hover:bg-brand-dark"
              >
                Approve equipment
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: EquipmentStatus }) {
  const styles = {
    "Pending approval": "bg-amber-50 text-amber-700 ring-amber-200",
    Approved: "bg-green-50 text-green-700 ring-green-200",
    Returned: "bg-rose/30 text-brand ring-rose",
  };

  const labels = {
    "Pending approval": "Pending",
    Approved: "Approved",
    Returned: "Returned",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-base font-medium text-gray-800">{value}</p>
    </div>
  );
}
