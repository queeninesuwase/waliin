"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Package,
  RefreshCw,
  UserRound,
  XCircle,
} from "lucide-react";

import Dialog from "@/components/ui/Dialog";
import { ApiError } from "@/lib/api/client";
import {
  getRequest,
  decideRequest,
  type ResourceRequest,
  type RequestDecisionPayload,
} from "@/features/requests/api";

const BRAND_BG = "bg-[#690d32]";
const BRAND_BORDER = "border-[#e8c5d0]";
const BRAND_TEXT = "text-[#700d32]";

type DecisionAction = RequestDecisionPayload["approval_status"];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 border-amber-200 text-amber-700",
  approved: `bg-[#700d32]/10 border-[#e8c5d0] ${BRAND_TEXT}`,
  rejected: `bg-[#700d32]/10 border-[#e8c5d0] ${BRAND_TEXT}`,
  returned: `bg-[#700d32]/10 border-[#e8c5d0] ${BRAND_TEXT}`,
  in_progress: `bg-[#700d32]/10 border-[#e8c5d0] ${BRAND_TEXT}`,
  resolved: `bg-[#700d32]/10 border-[#e8c5d0] ${BRAND_TEXT}`,
};

function normalizeStatus(status?: string | null) {
  return (status || "unknown").toLowerCase().trim().replaceAll(" ", "_");
}

function formatStatus(status?: string | null) {
  if (!status) return "Unknown";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shortId(value?: string | null) {
  if (!value) return "Not available";

  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-5)}` : value;
}

export default function RequestDetailsPage() {
  const pathname = usePathname();
  const requestId = pathname?.split("/").filter(Boolean).at(-1);

  const [request, setRequest] = useState<ResourceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [decisionAction, setDecisionAction] = useState<DecisionAction | null>(
    null,
  );
  const [decisionError, setDecisionError] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<{ reason: string }>({
    defaultValues: { reason: "" },
    mode: "onChange",
  });

  const loadRequest = useCallback(
    async (refresh = false) => {
      if (!requestId || requestId === "requests") {
        setError("The request ID could not be read from the URL.");
        setLoading(false);
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const result = await getRequest(requestId);
        setRequest(result);
      } catch (err) {
        console.error("Request loading error:", err);

        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to load this request. Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [requestId],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadRequest();
    });
  }, [loadRequest]);

  function openDecision(action: DecisionAction) {
    setDecisionAction(action);
    setDecisionError("");
    reset({ reason: "" });
    setSuccessMessage("");
  }

  function closeDecision() {
    if (decisionLoading) return;

    setDecisionAction(null);
    setDecisionError("");
    reset({ reason: "" });
  }

  const handleDecision = handleSubmit(async (data) => {
    if (!request || !decisionAction || decisionLoading) return;

    const reason = data.reason.trim();

    setDecisionLoading(true);
    setDecisionError("");

    try {
      await decideRequest(request.request_id, {
        approval_status: decisionAction,
        decision_reason: reason || undefined,
      });

      setSuccessMessage(
        decisionAction === "Approved"
          ? "Request approved successfully."
          : decisionAction === "Rejected"
            ? "Request rejected successfully."
            : "Request returned for correction.",
      );

      setDecisionAction(null);

      await loadRequest(true);
    } catch (err) {
      console.error("Decision submission error:", err);

      setDecisionError(
        err instanceof ApiError
          ? err.message
          : "Unable to submit the decision. Please try again.",
      );
    } finally {
      setDecisionLoading(false);
    }
  });

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center gap-3 text-base text-slate-500">
        <RefreshCw className="h-5 w-5 animate-spin" />
        Loading request...
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-w-0 w-full space-y-6 p-5 md:p-8">
        <Link
          href="/requests"
          className="inline-flex items-center gap-2 text-base font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to requests
        </Link>

        <div className={`rounded-xl ${BRAND_BORDER} bg-[#700d32]/5 p-5`}>
          <div className="flex items-center gap-2 font-semibold text-[#700d32]">
            <AlertCircle className="h-5 w-5" />
            Could not load request
          </div>

          <p className="mt-2 text-base text-slate-700">
            {error || "Request not found."}
          </p>

          <button
            type="button"
            onClick={() => void loadRequest()}
            className={`mt-4 rounded-lg ${BRAND_BG} px-4 py-2 text-base font-medium text-white hover:bg-[#570a27]`}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const status = normalizeStatus(request.status);
  const isPending = status === "pending";
  const items = request.items ?? [];

  const actionTitle =
    decisionAction === "Approved"
      ? "Approve request"
      : decisionAction === "Rejected"
        ? "Reject request"
        : "Return for correction";

  const actionDescription =
    decisionAction === "Approved"
      ? "Confirm that you have reviewed this request and want to approve it."
      : decisionAction === "Rejected"
        ? "Explain why this request cannot be approved."
        : "Explain what needs to be corrected before this request can be reviewed again.";

  return (
    <div className="min-w-0 w-full space-y-6 p-5 md:p-8">
      {/* Page heading */}
      <div>
        <Link
          href="/requests"
          className="mb-4 inline-flex items-center gap-2 text-base font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to requests
        </Link>

        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                Resource request
              </h1>

              <span
                className={`rounded-full px-3 py-1 text-base font-semibold ${
                  STATUS_STYLES[status] ??
                  "border-slate-200 bg-slate-100 text-slate-700"
                }`}
              >
                {formatStatus(status)}
              </span>
            </div>

            <p className="mt-2 break-all text-base text-slate-600">
              {request.request_number ||
                `REQ-${request.request_id.slice(0, 8).toUpperCase()}`}
              {" · "}
              Submitted {formatDate(request.requested_at)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isPending && (
              <>
                <button
                  type="button"
                  onClick={() => openDecision("Approved")}
                  className={`rounded-lg ${BRAND_BG} px-4 py-2.5 text-base font-semibold text-white hover:bg-[#570a27]`}
                >
                  Approve
                </button>

                <button
                  type="button"
                  onClick={() => openDecision("Rejected")}
                  className={`rounded-lg ${BRAND_BORDER} px-4 py-2.5 text-base font-semibold text-[#700d32] hover:bg-rose-50`}
                >
                  Reject
                </button>

                <button
                  type="button"
                  onClick={() => openDecision("Returned")}
                  className={`rounded-lg ${BRAND_BORDER} px-4 py-2.5 text-base font-semibold text-[#700d32] hover:bg-rose-50`}
                >
                  Return
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => void loadRequest(true)}
              disabled={refreshing}
              className={`rounded-lg ${BRAND_BORDER} bg-white p-2.5 text-[#700d32] hover:bg-rose-50 disabled:opacity-50`}
              aria-label="Refresh request"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Main content + sidebar grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Success message */}
          {successMessage && (
            <div
              role="status"
              className={`flex items-center gap-2 rounded-lg ${BRAND_BORDER} bg-[#700d32]/5 p-3 text-base text-[#700d32]`}
            >
              <CheckCircle2 className="h-5 w-5" />
              {successMessage}
            </div>
          )}

          {/* Request information */}
          <section className={`rounded-xl ${BRAND_BORDER} bg-white p-5`}>
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-500" />
              <h2 className="font-semibold text-slate-900">
                Request information
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Requested by</p>
                <p className="mt-1 flex items-center gap-2 text-base font-medium text-slate-900">
                  <UserRound className="h-4 w-4 text-slate-400" />
                  {request.requester_name || shortId(request.requested_by)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Request type</p>
                <p className="mt-1 text-base font-medium text-slate-900">
                  {formatStatus(request.request_type)}
                </p>
              </div>

              {request.related_fault_id && (
                <div>
                  <p className="text-xs text-slate-500">Related fault</p>
                  <p className="mt-1 break-all text-base font-medium text-slate-900">
                    {shortId(request.related_fault_id)}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-500">Submitted on</p>
                <p className="mt-1 text-base font-medium text-slate-900">
                  {formatDate(request.requested_at)}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500">
                Justification
              </p>
              <p className="mt-2 whitespace-pre-wrap text-base leading-6 text-slate-700">
                {request.justification?.trim() || "No justification provided."}
              </p>
            </div>
          </section>

          {/* Requested resources */}
          <section
            className={`overflow-hidden rounded-xl ${BRAND_BORDER} bg-white`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-500" />
                <h2 className="font-semibold text-slate-900">
                  Requested items
                </h2>
              </div>

              <span className="text-xs text-slate-500">
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
            </div>

            {items.length === 0 ? (
              <p className="p-6 text-base text-slate-500">
                No items have been added to this request.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <div
                    key={item.item_id ?? index}
                    className="flex flex-col justify-between gap-2 px-5 py-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {item.item_name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {item.part_number || "No part number"}
                        {item.specification ? ` · ${item.specification}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                      <span>
                        Requested:{" "}
                        <strong className="text-slate-900">
                          {item.quantity_requested} {item.unit || ""}
                        </strong>
                      </span>

                      {item.quantity_approved != null && (
                        <span>
                          Approved:{" "}
                          <strong className="text-slate-900">
                            {item.quantity_approved}
                          </strong>
                        </span>
                      )}

                      {(item.quantity_fulfilled ?? 0) > 0 && (
                        <span>
                          Fulfilled:{" "}
                          <strong className="text-slate-900">
                            {item.quantity_fulfilled}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:col-span-1">
          {/* Decision information */}
          <section
            className={`overflow-hidden rounded-xl ${BRAND_BORDER} bg-white`}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                {status === "approved" || status === "resolved" ? (
                  <CheckCircle2 className="h-5 w-5 text-[#700d32]" />
                ) : status === "rejected" ? (
                  <XCircle className="h-5 w-5 text-[#700d32]" />
                ) : (
                  <Clock3 className="h-5 w-5 text-[#700d32]" />
                )}

                <h2 className="font-semibold text-slate-900">
                  Decision information
                </h2>
              </div>
            </div>

            <div className="space-y-5 p-5">
              {isPending ? (
                <p className="text-base text-slate-600">
                  This request is awaiting your review and decision.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500">Decision date</p>
                    <p className="mt-1 text-base text-slate-800">
                      {formatDate(request.decided_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Decision reason</p>
                    <p className="mt-1 whitespace-pre-wrap text-base leading-6 text-slate-800">
                      {request.decision_reason?.trim() ||
                        "No decision reason recorded."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Decision actions */}
          {isPending && (
            <section className={`rounded-xl ${BRAND_BORDER} bg-white p-5`}>
              <h2 className="mb-3 text-base font-semibold uppercase tracking-wider text-slate-600">
                Take action
              </h2>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => openDecision("Approved")}
                  className={`w-full rounded-lg ${BRAND_BG} px-4 py-2.5 text-base font-semibold text-white hover:bg-[#570a27]`}
                >
                  Approve
                </button>

                <button
                  type="button"
                  onClick={() => openDecision("Rejected")}
                  className={`w-full rounded-lg ${BRAND_BORDER} px-4 py-2.5 text-base font-semibold text-[#700d32] hover:bg-rose-50`}
                >
                  Reject
                </button>

                <button
                  type="button"
                  onClick={() => openDecision("Returned")}
                  className={`w-full rounded-lg ${BRAND_BORDER} px-4 py-2.5 text-base font-semibold text-[#700d32] hover:bg-rose-50`}
                >
                  Return
                </button>
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* Decision dialog */}
      {decisionAction && (
        <Dialog
          title={actionTitle}
          description={actionDescription}
          onClose={closeDecision}
          closeButton
        >
          <form onSubmit={handleDecision} className="space-y-5">
            <div className="mt-5">
              <label
                htmlFor="decision-reason"
                className="mb-2 block text-base font-medium text-slate-700"
              >
                Reason
                {decisionAction === "Rejected" ? (
                  <span className="text-[#700d32]"> *</span>
                ) : (
                  <span className="text-slate-400"> (optional)</span>
                )}
              </label>

              <textarea
                id="decision-reason"
                {...register("reason", {
                  required:
                    decisionAction === "Rejected"
                      ? "Please provide a reason for rejecting this request."
                      : undefined,
                  maxLength: 1000,
                })}
                rows={4}
                maxLength={1000}
                placeholder="Write a short explanation..."
                className={`w-full rounded-lg ${BRAND_BORDER} p-3 text-base outline-none focus:border-[#700d32] focus:ring-2 focus:ring-[#700d32]/20`}
              />
            </div>

            {errors.reason && (
              <div
                role="alert"
                className="mt-3 flex gap-2 rounded-lg bg-[#700d32]/5 p-3 text-base text-[#700d32]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errors.reason.message}
              </div>
            )}

            {decisionError && (
              <div
                role="alert"
                className="mt-3 flex gap-2 rounded-lg bg-[#700d32]/5 p-3 text-base text-[#700d32]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {decisionError}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDecision}
                disabled={decisionLoading}
                className={`rounded-lg ${BRAND_BORDER} px-4 py-2.5 text-base font-medium text-[#700d32] hover:bg-rose-50 disabled:opacity-50`}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={decisionLoading}
                className={`inline-flex items-center gap-2 rounded-lg ${BRAND_BG} px-4 py-2.5 text-base font-semibold text-white hover:bg-[#570a27] disabled:opacity-50`}
              >
                {decisionLoading && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}

                {decisionLoading ? "Submitting..." : "Confirm"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
