"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getMyEquipment, EquipmentResponse } from "@/lib/api/equipment";

export default function BiomedicalEngineerDashboard() {
  const [equipment, setEquipment] = useState<EquipmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getMyEquipment()
      .then((records) => {
        if (active) setEquipment(records);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your equipment.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(
    () => ({
      total: equipment.length,
      pending: equipment.filter(
        (item) => item.registration_status.toLowerCase() === "pending",
      ).length,
      approved: equipment.filter(
        (item) => item.registration_status.toLowerCase() === "approved",
      ).length,
      returned: equipment.filter(
        (item) => item.registration_status.toLowerCase() === "returned",
      ).length,
      outOfService: equipment.filter(
        (item) => item.service_status === "out_of_service",
      ).length,
    }),
    [equipment],
  );

  const cards = [
    {
      title: "My equipment",
      count: counts.total,
      description: "Equipment registered by you",
      href: "/biomedical-engineer/equipment/list",
    },
    {
      title: "Pending approval",
      count: counts.pending,
      description: "Awaiting registration review",
      href: "/biomedical-engineer/equipment/list?status=pending",
    },
    {
      title: "Approved",
      count: counts.approved,
      description: "Approved registrations",
      href: "/biomedical-engineer/equipment/list?status=approved",
    },
    {
      title: "Returned",
      count: counts.returned,
      description: "Registrations requiring corrections",
      href: "/biomedical-engineer/equipment/list?status=returned",
    },
    {
      title: "Out of service",
      count: counts.outOfService,
      description: "Your equipment marked out of service",
      href: "/biomedical-engineer/equipment/list?service_status=out_of_service",
    },
  ];

  return (
    <main className="min-h-full bg-[#F8F6F3] px-4 py-6 text-[#263449] md:px-8 md:py-8 lg:px-10">
      <div className="w-full">
        <h1 className="text-3xl font-bold tracking-tight text-[#650d2f]">
          Equipment
        </h1>
        <p className="mt-1 text-sm text-gray-500 md:text-base">
          Monitor equipment you have registered.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/biomedical-engineer/register-equipment"
            className="inline-flex h-11 items-center rounded-lg bg-[#650D30] px-5 text-sm font-semibold text-white hover:bg-[#4F0A25]"
          >
            Register Equipment
          </Link>
          <Link
            href="/biomedical-engineer/equipment/list"
            className="inline-flex h-11 items-center rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold hover:bg-gray-100"
          >
            View Equipment List
          </Link>
        </div>

        {loading && (
          <p className="mt-8 rounded-lg bg-white p-5 shadow-sm">
            Loading your equipment overview...
          </p>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="mt-8 rounded-lg border border-red-200 bg-red-50 p-5 text-red-800"
          >
            <p className="font-semibold">Unable to load dashboard data</p>
            <p className="mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 rounded border border-red-300 px-3 py-2 hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {cards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  aria-label={`View ${card.title.toLowerCase()} equipment`}
                  className="block rounded-xl border border-[#E8B9C7] bg-white p-5 shadow-sm transition hover:border-[#D2A52C] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#D2A52C]"
                >
                  <p className="text-sm font-medium text-[#263449]/70">
                    {card.title}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#263449]">
                    {card.count}
                  </p>
                  <p className="mt-2 text-sm text-[#263449]/70">
                    {card.description}
                  </p>
                </Link>
              ))}
            </div>

            <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#650d2f]">
                    Recently registered equipment
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    The latest records returned for your account.
                  </p>
                </div>
                <Link
                  href="/biomedical-engineer/equipment/list"
                  className="text-sm font-semibold text-[#650D30] hover:text-[#4F0A25] hover:underline"
                >
                  View all equipment
                </Link>
              </div>

              {equipment.length === 0 ? (
                <div className="mt-5 rounded-lg bg-gray-50 p-6 text-center">
                  <p className="font-medium">No equipment registered yet</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Register equipment or import a CSV to see records here.
                  </p>
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-3 py-3">Asset tag</th>
                        <th className="px-3 py-3">Equipment</th>
                        <th className="px-3 py-3">Location</th>
                        <th className="px-3 py-3">Registration</th>
                        <th className="px-3 py-3">Service status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {equipment.slice(0, 5).map((item) => (
                        <tr key={item.equipment_id}>
                          <td className="whitespace-nowrap px-3 py-3 font-medium">
                            {item.asset_tag}
                          </td>
                          <td className="px-3 py-3">
                            <div>{item.manufacturer}</div>
                            <div className="text-gray-500">
                              {item.model_name}
                            </div>
                          </td>
                          <td className="px-3 py-3">{item.location}</td>
                          <td className="whitespace-nowrap px-3 py-3">
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
                          <td className="whitespace-nowrap px-3 py-3">
                            {item.service_status.replaceAll("_", " ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
