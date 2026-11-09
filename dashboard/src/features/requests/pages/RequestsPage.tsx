"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Package,
  RefreshCw,
  Search,
} from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { getRequests, type ResourceRequest } from "@/features/requests/api";
import { listUsers } from "@/features/users/api";

const PAGE_SIZE = 12;

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Returned", value: "returned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
] as const;

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function readableStatus(status?: string | null) {
  if (!status) return "Unknown";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusStyle(status?: string | null) {
  switch (status?.toLowerCase()) {
    case "approved":
    case "resolved":
      return "bg-emerald-100 text-emerald-800";

    case "pending":
      return "bg-amber-100 text-amber-800";

    case "in_progress":
      return "bg-blue-100 text-blue-800";

    case "rejected":
      return "bg-rose-100 text-rose-800";

    case "returned":
      return "bg-orange-100 text-orange-800";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function readableRequestType(value?: string) {
  if (!value) return "Resource request";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function shortId(id?: string | null) {
  if (!id) return "—";

  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function getItemsSummary(request: ResourceRequest) {
  const items = request.items ?? [];

  if (items.length === 0) return "No items listed";

  const firstItem = items[0];
  const remaining = items.length - 1;

  return remaining > 0
    ? `${firstItem.item_name} + ${remaining} more`
    : firstItem.item_name;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load resource requests.
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getRequests();
      setRequests(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not load resource requests. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRequests();
    });
  }, [loadRequests]);

  // Load user names for the "Requested by" column.
  useEffect(() => {
    let active = true;

    listUsers()
      .then((users) => {
        if (!active) return;

        setUserNames(
          users.reduce<Record<string, string>>((map, user) => {
            map[user.user_id] = user.full_name || user.email;
            return map;
          }, {}),
        );
      })
      .catch(() => {
        // User names are a non-critical enhancement; ignore failures.
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const status = request.status?.toLowerCase() ?? "";

      const matchesStatus = activeFilter === "all" || status === activeFilter;

      const requesterName = userNames[request.requested_by] ?? "";

      const searchableText = [
        request.request_id,
        request.requested_by,
        requesterName,
        request.related_fault_id,
        request.request_type,
        request.justification,
        request.status,
        request.decision_reason,
        ...(request.items ?? []).flatMap((item) => [
          item.item_name,
          item.part_number,
          item.specification,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && searchableText.includes(query);
    });
  }, [requests, search, activeFilter, userNames]);

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((request) => request.status === "pending")
        .length,
      approved: requests.filter((request) => request.status === "approved")
        .length,
      rejected: requests.filter((request) => request.status === "rejected")
        .length,
      returned: requests.filter((request) => request.status === "returned")
        .length,
      in_progress: requests.filter(
        (request) => request.status === "in_progress",
      ).length,
      resolved: requests.filter((request) => request.status === "resolved")
        .length,
    };
  }, [requests]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / PAGE_SIZE),
  );

  // Reset pagination when the search or selected status changes.
  useEffect(() => {
    queueMicrotask(() => {
      setCurrentPage(1);
    });
  }, [search, activeFilter]);

  // Keep the current page valid when results shrink after refresh/filtering.
  useEffect(() => {
    queueMicrotask(() => {
      setCurrentPage((page) => Math.min(page, totalPages));
    });
  }, [totalPages]);

  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;

    return filteredRequests.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRequests, currentPage]);

  const firstResult =
    filteredRequests.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;

  const lastResult = Math.min(currentPage * PAGE_SIZE, filteredRequests.length);

  // Show first, last, and nearby pages without displaying too many numbers.
  const visiblePages = useMemo(() => {
    const pages = new Set<number>([1, totalPages]);

    for (
      let page = Math.max(1, currentPage - 1);
      page <= Math.min(totalPages, currentPage + 1);
      page++
    ) {
      pages.add(page);
    }

    return [...pages].sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  return (
    <section className="min-w-0 w-full p-5 md:p-8">
      {/* Page title */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package size={24} className="text-[#700d32]" />
            <h1 className="text-2xl font-bold text-slate-800">
              Resource Requests
            </h1>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Review equipment parts and resource requests submitted by hospital
            staff.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRequests()}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[#e8c5d0] bg-white px-4 py-2.5 text-sm font-medium text-[#700d32] transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="mb-5 flex w-full max-w-xl items-center gap-3 rounded-lg border border-[#e8c5d0] bg-white px-4 py-3 focus-within:border-[#700d32]">
        <Search size={18} className="shrink-0 text-slate-400" />

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search request ID, type, requester or items..."
          aria-label="Search resource requests"
          className="w-full min-w-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />

        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="shrink-0 text-xs font-medium text-[#700d32] hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Status filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.value;
          const count = counts[filter.value];

          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm transition ${
                isActive
                  ? "border-[#700d32] bg-[#700d32] text-white"
                  : "border-[#e5c7d0] bg-white text-slate-700 hover:bg-rose-50"
              }`}
            >
              {filter.label}

              <span
                className={`rounded-md px-1.5 py-0.5 text-xs ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results heading */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Submitted requests
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Review each request to see its details and decision information.
          </p>
        </div>

        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-800">
            {filteredRequests.length}
          </span>{" "}
          {filteredRequests.length === 1 ? "result" : "results"}
        </p>
      </div>

      {/* Requests table and pagination */}
      <div className="w-full min-w-0 overflow-hidden rounded-xl border border-[#e8c5d0] bg-white">
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left">
            <thead className="bg-[#e5b7c5] text-[#5d1530]">
              <tr>
                <th className="whitespace-nowrap px-4 py-4 text-xs font-semibold">
                  Request ID
                </th>
                <th className="whitespace-nowrap px-4 py-4 text-xs font-semibold">
                  Request type
                </th>
                <th className="px-4 py-4 text-xs font-semibold">
                  Requested items
                </th>
                <th className="whitespace-nowrap px-4 py-4 text-xs font-semibold">
                  Requested by
                </th>
                <th className="whitespace-nowrap px-4 py-4 text-xs font-semibold">
                  Date requested
                </th>
                <th className="whitespace-nowrap px-4 py-4 text-xs font-semibold">
                  Status
                </th>
                <th className="px-4 py-4 text-xs font-semibold">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-16 text-center text-sm text-slate-500"
                  >
                    <RefreshCw
                      size={20}
                      className="mx-auto mb-3 animate-spin text-[#700d32]"
                    />
                    Loading resource requests...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <AlertCircle
                      size={24}
                      className="mx-auto mb-3 text-rose-600"
                    />

                    <p className="text-sm font-semibold text-slate-800">
                      Could not load resource requests
                    </p>

                    <p className="mx-auto mt-2 max-w-md text-sm text-rose-700">
                      {error}
                    </p>

                    <button
                      type="button"
                      onClick={() => void loadRequests()}
                      className="mt-4 rounded-md bg-[#700d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#570a27]"
                    >
                      Try again
                    </button>
                  </td>
                </tr>
              ) : paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Package
                      size={28}
                      className="mx-auto mb-3 text-slate-300"
                    />

                    <p className="text-sm font-semibold text-slate-800">
                      No resource requests found
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Try another status filter or search term.
                    </p>

                    {(search || activeFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setActiveFilter("all");
                          setCurrentPage(1);
                        }}
                        className="mt-3 text-sm font-medium text-[#700d32] hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((request) => {
                  const requesterName =
                    userNames[request.requested_by] ??
                    shortId(request.requested_by);

                  return (
                    <tr
                      key={request.request_id}
                      className="transition hover:bg-[#fcf5f7]"
                    >
                      <td className="px-4 py-4">
                        <span
                          title={request.request_id}
                          className="font-mono text-xs font-semibold text-slate-800"
                        >
                          {shortId(request.request_id)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {readableRequestType(request.request_type)}
                      </td>

                      <td className="max-w-[240px] px-4 py-4">
                        <p
                          title={getItemsSummary(request)}
                          className="truncate text-sm font-medium text-slate-700"
                        >
                          {getItemsSummary(request)}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {request.items?.length ?? 0}{" "}
                          {(request.items?.length ?? 0) === 1
                            ? "item"
                            : "items"}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          title={request.requested_by}
                          className="text-sm text-slate-700"
                        >
                          {requesterName}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                        {formatDate(request.requested_at)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium ${statusStyle(
                            request.status,
                          )}`}
                        >
                          {readableStatus(request.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <Link
                          href={`/requests/${encodeURIComponent(request.request_id)}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-[#700d32] transition hover:bg-rose-50"
                          aria-label={`View request ${shortId(request.request_id)}`}
                        >
                          View details
                          <ChevronRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination footer */}
        {!loading && !error && filteredRequests.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <nav
              aria-label="Resource request pagination"
              className="flex flex-wrap items-center gap-1"
            >
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronLeft size={16} />
              </button>

              {visiblePages.map((page, index) => {
                const previousPage = visiblePages[index - 1];
                const needsEllipsis =
                  previousPage !== undefined && page - previousPage > 1;

                return (
                  <span key={page} className="flex items-center gap-1">
                    {needsEllipsis && (
                      <span className="px-1 text-xs text-slate-400">…</span>
                    )}

                    <button
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      aria-current={currentPage === page ? "page" : undefined}
                      className={`min-w-8 rounded-md px-2.5 py-1.5 text-xs transition ${
                        currentPage === page
                          ? "bg-[#700d32] font-semibold text-white"
                          : "text-slate-600 hover:bg-rose-50"
                      }`}
                    >
                      {page}
                    </button>
                  </span>
                );
              })}

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronRight size={16} />
              </button>
            </nav>

            <p className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-medium text-slate-700">
                {firstResult}–{lastResult}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-700">
                {filteredRequests.length}
              </span>
            </p>
          </div>
        )}
        =
      </div>
    </section>
  );
}
