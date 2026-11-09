"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getMyEquipment,
  updateEquipment,
  resubmitEquipment,
  EquipmentResponse,
  EquipmentUpdateRequest,
} from "@/lib/api/equipment";

export default function MyEquipmentPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 p-4 text-gray-900 md:p-8">
          Loading your equipment...
        </main>
      }
    >
      <MyEquipmentContent />
    </Suspense>
  );
}

function MyEquipmentContent() {
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status")?.toLowerCase() ?? "";
  const serviceStatusFilter =
    searchParams.get("service_status")?.toLowerCase() ?? "";
  const [equipment, setEquipment] = useState<EquipmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EquipmentUpdateRequest>({});
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    getMyEquipment()
      .then((data) => {
        if (active) setEquipment(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Unable to load your equipment.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      const matchesRegistration =
        !statusFilter ||
        item.registration_status.toLowerCase() === statusFilter;

      const matchesService =
        !serviceStatusFilter ||
        item.service_status.toLowerCase() === serviceStatusFilter;

      return matchesRegistration && matchesService;
    });
  }, [equipment, statusFilter, serviceStatusFilter]);

  const showingReturned = statusFilter === "returned";

  function beginEdit(item: EquipmentResponse) {
    setEditingId(item.equipment_id);
    setEditForm({
      manufacturer: item.manufacturer,
      model_name: item.model_name,
      model_number: item.model_number ?? "",
      equipment_category: item.equipment_category,
      department_id: item.department_id,
      asset_tag: item.asset_tag,
      serial_number: item.serial_number ?? "",
      location: item.location,
    });
    setActionMessage("");
    setActionError("");
  }

  function updateField(field: keyof EquipmentUpdateRequest, value: string) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function saveChanges() {
    if (!editingId) return;

    setSaving(true);
    setActionError("");
    setActionMessage("");

    try {
      const updated = await updateEquipment(editingId, editForm);
      setEquipment((current) =>
        current.map((item) =>
          item.equipment_id === editingId ? { ...item, ...updated } : item,
        ),
      );
      setActionMessage("Changes saved. You can now resubmit for approval.");
      setEditingId(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to save changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitAgain(item: EquipmentResponse) {
    setResubmitting(true);
    setActionError("");
    setActionMessage("");

    try {
      await resubmitEquipment(item.equipment_id);
      setEquipment((current) =>
        current.filter((record) => record.equipment_id !== item.equipment_id),
      );
      setActionMessage(
        `${item.asset_tag} was resubmitted and is now pending approval.`,
      );
      setEditingId(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to resubmit equipment.",
      );
    } finally {
      setResubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {showingReturned ? "Returned Equipment" : "My Equipment"}
            </h1>
            <p className="mt-2 text-gray-600">
              {showingReturned
                ? "Equipment registrations that need corrections."
                : "Equipment registered by your account."}
            </p>
          </div>
          <Link
            href="/biomedical-engineer/register-equipment"
            className="rounded-lg bg-[#650D30] px-5 py-3 text-white hover:bg-[#4F0A25]"
          >
            Register Equipment
          </Link>
        </div>

        {actionMessage && (
          <p
            role="status"
            className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"
          >
            {actionMessage}
          </p>
        )}

        {actionError && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          >
            {actionError}
          </p>
        )}

        {loading && (
          <p className="mt-8 rounded-lg bg-white p-6 shadow-sm">
            Loading your equipment...
          </p>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="mt-8 rounded-lg border border-red-200 bg-red-50 p-5 text-red-800"
          >
            <p className="font-semibold">Could not load equipment</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2 text-sm">
              Check that you are signed in, then refresh this page.
            </p>
          </div>
        )}

        {!loading && !error && filteredEquipment.length === 0 && (
          <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold">
              {showingReturned ? "No returned equipment" : "No equipment yet"}
            </h2>
            <p className="mt-2 text-gray-600">
              {showingReturned
                ? "There are no returned registrations to correct."
                : "Equipment you register will appear here."}
            </p>
          </div>
        )}

        {!loading && !error && equipment.length > 0 && (
          <>
            <p className="mt-6 text-sm text-gray-600">
              {filteredEquipment.length} equipment record
              {filteredEquipment.length === 1 ? "" : "s"}
            </p>

            <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    {[
                      "Asset tag",
                      "Equipment",
                      "Category",
                      "Department ID",
                      "Location",
                      "Registration",
                      "Installation",
                      "Service",
                      ...(showingReturned ? ["Actions"] : []),
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-4 py-3 font-semibold"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEquipment.map((item) => (
                    <tr key={item.equipment_id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {item.asset_tag}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.manufacturer}</div>
                        <div className="text-gray-600">{item.model_name}</div>
                        {item.model_number && (
                          <div className="text-xs text-gray-500">
                            Model no. {item.model_number}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{item.equipment_category}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        {item.department_id}
                      </td>
                      <td className="px-4 py-3">{item.location}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-3 py-1 text-sm font-medium ${
                            item.registration_status.toLowerCase() ===
                            "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : item.registration_status.toLowerCase() ===
                                  "pending"
                                ? "bg-amber-100 text-amber-700"
                                : item.registration_status.toLowerCase() ===
                                    "returned"
                                  ? "bg-[#E8B9C7] text-[#650D30]"
                                  : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.registration_status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {item.installation_status.replaceAll("_", " ")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {item.service_status.replaceAll("_", " ")}
                      </td>
                      {showingReturned && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => beginEdit(item)}
                              className="rounded-md border border-[#650D30]/40 px-3 py-2 text-[#650D30] hover:bg-[#F8F6F3]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={
                                resubmitting || editingId === item.equipment_id
                              }
                              onClick={() => submitAgain(item)}
                              className="rounded-md bg-[#650D30] px-3 py-2 text-white hover:bg-[#4F0A25] disabled:opacity-50"
                            >
                              {resubmitting ? "Resubmitting..." : "Resubmit"}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {showingReturned && editingId && (
              <section className="mt-6 rounded-lg border border-[#E8B9C7] bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold">
                  Correct returned equipment
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Save your corrections before resubmitting for approval.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["manufacturer", "Manufacturer"],
                      ["model_name", "Model name"],
                      ["model_number", "Model number"],
                      ["equipment_category", "Equipment category"],
                      ["department_id", "Department ID"],
                      ["asset_tag", "Asset tag"],
                      ["serial_number", "Serial number"],
                      ["location", "Location"],
                    ] as const
                  ).map(([field, label]) => (
                    <label
                      key={field}
                      className="block text-sm font-medium text-gray-700"
                    >
                      {label}
                      <input
                        value={String(editForm[field] ?? "")}
                        onChange={(event) =>
                          updateField(field, event.target.value)
                        }
                        required={[
                          "manufacturer",
                          "model_name",
                          "equipment_category",
                          "department_id",
                          "asset_tag",
                          "location",
                        ].includes(field)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={saveChanges}
                    disabled={saving}
                    className="rounded-md bg-[#650D30] px-4 py-2 text-white hover:bg-[#4F0A25] disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
