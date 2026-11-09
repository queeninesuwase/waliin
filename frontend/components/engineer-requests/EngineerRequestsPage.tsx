"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import {
  Card,
  LoadError,
  PageTitle,
  Skeleton,
} from "@/components/maintenance/ui";
import { useUserProfile } from "@/components/providers/UserProfileProvider";
import {
  createResourceRequest,
  REQUEST_TYPES,
  type RequestType,
} from "@/lib/api/faults";
import { errorMessage } from "@/lib/api/maintenance";
import {
  canEdit,
  getAllRequests,
  hasRequirements,
  isResubmitted,
  markResubmitted,
  parseRequirements,
  editableItems,
  editProblem,
  requestStatus,
  requestTitle,
  requestTypeLabel,
  sortNewest,
  splitJustification,
  updateJustification,
  updateRequest,
  withRequirements,
  type EngineerRequest,
  type Requirements,
} from "@/lib/api/requests";

type Tab = "mine" | "wards";

const FIELD =
  "w-full rounded-lg border border-[#e8b4c0] bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-[#650d2f] focus:outline-none";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-sky-50 text-sky-700 ring-sky-200",
  in_progress: "bg-sky-50 text-sky-700 ring-sky-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  returned: "bg-[#e8b4c0]/40 text-[#650d2f] ring-[#e8b4c0]",
};

function shortDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusPill({ request }: { request: EngineerRequest }) {
  const key = (request.status ?? "pending").toLowerCase();
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ${
        STATUS_STYLE[key] ?? STATUS_STYLE.pending
      }`}
    >
      {requestStatus(request)}
    </span>
  );
}

type ItemValues = {
  name: string;
  quantity: string;
  specs: string;
};

type RequestValues = {
  type: RequestType;
  why: string;
  items: ItemValues[];
};

function isRequestType(value: string): value is RequestType {
  return REQUEST_TYPES.some((option) => option.value === value);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="alert" className="text-xs font-medium text-red-700">
      {message}
    </span>
  );
}

function checkQuantity(value: string) {
  const number = Number(value);
  return (
    (Number.isInteger(number) && number >= 1) || "Quantity must be at least 1."
  );
}

function RequestForm({
  engineerId,
  editing,
  onDone,
}: {
  engineerId: string;
  editing?: EngineerRequest;
  onDone: (message: string) => void;
}) {
  const returned = (editing?.status ?? "").toLowerCase() === "returned";
  const blocked = editing ? editProblem(editing) : null;
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RequestValues>({
    mode: "onTouched",
    defaultValues: editing
      ? {
          type: isRequestType(editing.request_type)
            ? editing.request_type
            : "spare_parts",
          why: splitJustification(editing.justification).reason,
          items: editableItems(editing).map((item) => ({
            name: item.name,
            quantity: String(item.quantity),
            specs: item.specification,
          })),
        }
      : {
          type: "spare_parts",
          why: "",
          items: [{ name: "", quantity: "1", specs: "" }],
        },
  });
  const { fields } = useFieldArray({ control, name: "items" });

  if (editing && blocked) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        {blocked}
      </p>
    );
  }

  async function submit(values: RequestValues) {
    const items = values.items.map((item) => ({
      name: item.name.trim(),
      quantity: Number(item.quantity),
      specification: item.specs,
    }));
    try {
      if (editing) {
        const justification = returned
          ? markResubmitted(values.why, new Date())
          : values.why.trim();
        await updateRequest(editing.request_id, {
          request_type: isRequestType(editing.request_type)
            ? values.type
            : editing.request_type,
          justification,
          items,
        });
        onDone(
          returned
            ? `${editing.request_number ?? "Your request"} was corrected and sent back to the health manager.`
            : `${editing.request_number ?? "Your request"} was updated.`,
        );
        return;
      }
      const made = await createResourceRequest(engineerId, {
        request_type: values.type,
        justification: values.why.trim(),
        related_fault_id: null,
        items: items.map((item) => ({
          item_name_or_service: item.name,
          technical_specifications: item.specification.trim() || null,
          quantity_requested: item.quantity,
        })),
      });
      onDone(
        `${made.request_number ?? "Your request"} was sent to the health manager.`,
      );
    } catch (err) {
      setError("root", {
        message: errorMessage(
          err,
          editing
            ? "Could not save your changes. Try again."
            : "Could not send the request. Try again.",
        ),
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      className="grid gap-4 md:grid-cols-2"
    >
      {returned && editing?.decision_reason && (
        <div className="rounded-lg border border-[#e8b4c0] bg-[#e8b4c0]/20 px-4 py-3 text-sm text-[#650d2f] md:col-span-2">
          <span className="font-semibold">Manager&apos;s note: </span>
          {editing.decision_reason}
        </div>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
        What do you need?
        <select
          className={FIELD}
          disabled={!!editing && !isRequestType(editing.request_type)}
          {...register("type")}
        >
          {REQUEST_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
        Why is it needed?
        <textarea
          rows={2}
          placeholder="For example: stock for the ICU monitors runs out next month"
          className={FIELD}
          aria-invalid={!!errors.why}
          {...register("why", {
            validate: (value) =>
              value.trim() !== "" || "Explain why this is needed.",
          })}
        />
        <FieldError message={errors.why?.message} />
      </label>

      <fieldset className="flex flex-col gap-3 md:col-span-2">
        <legend className="mb-2 text-sm font-semibold text-gray-900">
          {fields.length > 1 ? `Items (${fields.length})` : "Item"}
        </legend>
        {fields.map((field, index) => {
          const itemErrors = errors.items?.[index];
          return (
            <div
              key={field.id}
              className="grid gap-3 rounded-xl border border-[#e8b4c0]/70 bg-white p-3 md:grid-cols-[minmax(0,2fr)_110px_minmax(0,2fr)]"
            >
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
                Part, service or machine
                <input
                  placeholder="For example: SpO2 cable"
                  className={`${FIELD} read-only:bg-gray-50 read-only:text-gray-600`}
                  readOnly={!!editing}
                  aria-invalid={!!itemErrors?.name}
                  {...register(`items.${index}.name`, {
                    validate: (value) =>
                      value.trim() !== "" ||
                      "Name the part, service or machine you need.",
                  })}
                />
                <FieldError message={itemErrors?.name?.message} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
                Quantity
                <input
                  type="number"
                  min={1}
                  className={FIELD}
                  aria-invalid={!!itemErrors?.quantity}
                  {...register(`items.${index}.quantity`, {
                    validate: checkQuantity,
                  })}
                />
                <FieldError message={itemErrors?.quantity?.message} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
                <span>
                  Part number or technical details{" "}
                  <span className="font-normal text-gray-500">(optional)</span>
                </span>
                <input
                  placeholder="For example: 220 V, 50 Hz, OEM part 989803"
                  className={FIELD}
                  {...register(`items.${index}.specs`)}
                />
              </label>
            </div>
          );
        })}
        {editing && (
          <span className="text-xs text-gray-500">
            Item names cannot be changed here. To ask for a different item, send
            a new request.
          </span>
        )}
      </fieldset>

      {errors.root?.message && (
        <p role="alert" className="text-sm text-red-700 md:col-span-2">
          {errors.root.message}
        </p>
      )}
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 rounded-lg bg-[#650d2f] px-6 text-sm font-semibold text-white hover:bg-[#4e0a25] disabled:opacity-60"
        >
          {isSubmitting
            ? "Saving..."
            : !editing
              ? "Send to manager"
              : returned
                ? "Resubmit to manager"
                : "Save changes"}
        </button>
      </div>
    </form>
  );
}

const REQUIREMENT_FIELDS: [keyof Requirements, string, string, string][] = [
  [
    "power",
    "Power and voltage",
    "For example: 220 V, 50 Hz",
    "Add the power and voltage needed.",
  ],
  [
    "parts",
    "Spare parts and accessories that must come with it",
    "For example: 2 probes, spare battery, paper rolls",
    "List the spare parts and accessories.",
  ],
  [
    "service",
    "Local service support and manuals",
    "For example: service manual in English, local agent in Addis Ababa",
    "Say what service support and manuals are needed.",
  ],
  [
    "training",
    "Training for users and engineers",
    "For example: 1 day for midwives, 2 days for engineers",
    "Say what training users and engineers need.",
  ],
];

function RequirementsForm({
  request,
  onSaved,
}: {
  request: EngineerRequest;
  onSaved: (message: string) => void;
}) {
  const editing = hasRequirements(request.justification);
  const returned = (request.status ?? "").toLowerCase() === "returned";
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Requirements>({
    mode: "onTouched",
    defaultValues: parseRequirements(request.justification),
  });

  async function submit(values: Requirements) {
    const text = withRequirements(request.justification, values);
    try {
      await updateJustification(
        request.request_id,
        returned ? markResubmitted(text, new Date()) : text,
      );
      onSaved(
        returned
          ? "Technical requirements corrected and sent back to the health manager."
          : editing
            ? "Technical requirements updated."
            : "Technical requirements added. The manager can now send it.",
      );
    } catch (err) {
      setError("root", {
        message: errorMessage(err, "Could not save the requirements."),
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      className="mt-4 grid gap-4 rounded-xl bg-[#fbfaf7] p-4 md:grid-cols-2"
    >
      {returned && request.decision_reason && (
        <div className="rounded-lg border border-[#e8b4c0] bg-[#e8b4c0]/20 px-4 py-3 text-sm text-[#650d2f] md:col-span-2">
          <span className="font-semibold">Manager&apos;s note: </span>
          {request.decision_reason}
        </div>
      )}
      {REQUIREMENT_FIELDS.map(([key, label, hint, message]) => (
        <label
          key={key}
          className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900"
        >
          {label}
          <input
            placeholder={hint}
            className={FIELD}
            aria-invalid={!!errors[key]}
            {...register(key, {
              validate: (value) => value.trim() !== "" || message,
            })}
          />
          <FieldError message={errors[key]?.message} />
        </label>
      ))}
      {errors.root?.message && (
        <p role="alert" className="text-sm text-red-700 md:col-span-2">
          {errors.root.message}
        </p>
      )}
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 rounded-lg bg-[#650d2f] px-6 text-sm font-semibold text-white hover:bg-[#4e0a25] disabled:opacity-60"
        >
          {isSubmitting
            ? "Saving..."
            : returned
              ? "Resubmit to manager"
              : editing
                ? "Save changes"
                : "Save requirements"}
        </button>
      </div>
    </form>
  );
}

function RequestRow({
  request,
  engineerId,
  ward,
  onEdit,
  editing,
  onSaved,
}: {
  request: EngineerRequest;
  engineerId: string;
  ward: boolean;
  onEdit: () => void;
  editing: boolean;
  onSaved: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { reason, requirements } = splitJustification(request.justification);
  const status = (request.status ?? "pending").toLowerCase();
  const hasSpecs = hasRequirements(request.justification);
  const needsSpecs =
    ward &&
    request.request_type === "new_equipment" &&
    !hasSpecs &&
    canEdit(request);
  const editable = ward
    ? request.request_type === "new_equipment" && canEdit(request)
    : canEdit(request);
  const editLabel = ward
    ? hasSpecs
      ? "Edit requirements"
      : "Add requirements"
    : status === "returned"
      ? "Edit and resubmit"
      : "Edit";

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-900">
              {requestTitle(request)}
            </p>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {requestTypeLabel(request.request_type)}
            </span>
            {needsSpecs && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                Needs technical requirements
              </span>
            )}
            {status === "returned" && !isResubmitted(request) && (
              <span className="rounded-full bg-[#e8b4c0]/40 px-2 py-0.5 text-xs font-semibold text-[#650d2f]">
                Needs your changes
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {request.request_number ?? request.request_id.slice(0, 8)} ·{" "}
            {shortDate(request.requested_at)}
            {ward && request.requester_name
              ? ` · ${request.requester_name}`
              : ""}
          </p>
        </div>
        <StatusPill request={request} />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="text-sm font-semibold text-[#650d2f] hover:underline"
        >
          {open ? "Hide" : "Details"}
        </button>
        {editable && (
          <button
            type="button"
            onClick={onEdit}
            aria-expanded={editing}
            className="rounded-lg bg-[#650d2f] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#4e0a25]"
          >
            {editing ? "Close" : editLabel}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 grid gap-3 rounded-xl bg-[#fbfaf7] p-4 text-sm text-gray-700 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">
              Why it is needed
            </p>
            <p className="mt-1 whitespace-pre-line">{reason || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">
              {ward ? "Technical requirements" : "Items"}
            </p>
            {ward ? (
              <p className="mt-1 whitespace-pre-line">
                {requirements || "Not added yet"}
              </p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1">
                {editableItems(request).map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    <span className="font-semibold">{item.name || "—"}</span> ×{" "}
                    {item.quantity}
                    {item.specification ? ` · ${item.specification}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {request.decision_reason && (
            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">
                Manager&apos;s note
              </p>
              <p className="mt-1">{request.decision_reason}</p>
            </div>
          )}
          {request.related_fault_id && (
            <Link
              href={`/biomedical-engineer/faults/${request.related_fault_id}`}
              className="w-fit font-semibold text-[#650d2f] hover:underline"
            >
              Open the related fault →
            </Link>
          )}
        </div>
      )}

      {editing &&
        (ward ? (
          <RequirementsForm request={request} onSaved={onSaved} />
        ) : (
          <div className="mt-4 rounded-xl bg-[#fbfaf7] p-4">
            <RequestForm
              engineerId={engineerId}
              editing={request}
              onDone={onSaved}
            />
          </div>
        ))}
    </li>
  );
}

export default function EngineerRequestsPage() {
  const { user } = useUserProfile();
  const engineerId = user?.user_id ?? "";
  const [requests, setRequests] = useState<EngineerRequest[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab>("mine");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    getAllRequests().then(
      (list) => {
        if (!active) return;
        setRequests(sortNewest(list));
        setError("");
      },
      (err: unknown) => {
        if (active)
          setError(errorMessage(err, "Could not load requests. Try again."));
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  function reload(message: string) {
    setNotice(message);
    setCreating(false);
    setEditing(null);
    setAttempt((count) => count + 1);
  }

  const view = useMemo(() => {
    const list = requests ?? [];
    const mine = list.filter((request) => request.requested_by === engineerId);
    const wards = list.filter(
      (request) =>
        request.request_type === "new_equipment" &&
        request.requested_by !== engineerId,
    );
    const status = (request: EngineerRequest) =>
      (request.status ?? "pending").toLowerCase();
    return {
      mine,
      wards,
      waiting: mine.filter(
        (request) => status(request) === "pending" || isResubmitted(request),
      ).length,
      approved: mine.filter((request) =>
        ["approved", "in_progress", "resolved"].includes(status(request)),
      ).length,
      changes: mine.filter(
        (request) =>
          status(request) === "rejected" ||
          (status(request) === "returned" && !isResubmitted(request)),
      ).length,
      needSpecs: wards.filter(
        (request) =>
          !hasRequirements(request.justification) &&
          ["pending", "returned"].includes(status(request)),
      ).length,
    };
  }, [requests, engineerId]);

  const shown = tab === "mine" ? view.mine : view.wards;

  return (
    <div className="min-h-full bg-[#F8F6F3] px-4 py-6 text-[#263449] md:px-8 md:py-8 lg:px-10">
      <div className="flex w-full flex-col gap-6">
        <PageTitle
          title="Requests"
          subtitle="Parts, outside help and replacements you asked for, and equipment the wards need."
          action={
            <button
              type="button"
              onClick={() => setCreating((value) => !value)}
              className="h-11 rounded-lg bg-[#d9a00a] px-5 text-sm font-semibold text-white hover:opacity-90"
            >
              {creating ? "Close" : "New request"}
            </button>
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

        {creating && engineerId && (
          <Card>
            <h2 className="mb-4 text-lg font-bold text-[#650d2f]">
              New request to the health manager
            </h2>
            <RequestForm engineerId={engineerId} onDone={reload} />
          </Card>
        )}

        {error && !requests ? (
          <LoadError
            message={error}
            onRetry={() => {
              setError("");
              setAttempt((count) => count + 1);
            }}
          />
        ) : !requests ? (
          <Skeleton rows={4} />
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <span>{error} Showing the requests from the last load.</span>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setAttempt((count) => count + 1);
                  }}
                  className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100"
                >
                  Retry
                </button>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Waiting for manager",
                  value: view.waiting,
                  tone: "text-amber-600",
                },
                {
                  label: "Approved or sent",
                  value: view.approved,
                  tone: "text-emerald-600",
                },
                {
                  label: "Need changes or declined",
                  value: view.changes,
                  tone: "text-[#650d2f]",
                },
                {
                  label: "Ward requests to specify",
                  value: view.needSpecs,
                  tone: "text-red-600",
                },
              ].map((card) => (
                <Card key={card.label}>
                  <p className="text-sm font-semibold text-gray-600">
                    {card.label}
                  </p>
                  <p className={`mt-2 text-3xl font-bold ${card.tone}`}>
                    {card.value}
                  </p>
                </Card>
              ))}
            </div>

            <Card>
              <div
                role="tablist"
                className="mb-2 flex gap-1 rounded-lg bg-[#fbfaf7] p-1 ring-1 ring-[#e8b4c0]"
              >
                {(
                  [
                    ["mine", `My requests (${view.mine.length})`],
                    [
                      "wards",
                      `Equipment requests from wards (${view.wards.length})`,
                    ],
                  ] as [Tab, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => {
                      setTab(key);
                      setEditing(null);
                    }}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
                      tab === key
                        ? "bg-[#650d2f] text-white"
                        : "text-gray-600 hover:bg-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {shown.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  {tab === "mine"
                    ? "You have not sent any requests yet. Use New request, or Request parts or help on a fault."
                    : "No equipment requests from the wards yet."}
                </p>
              ) : (
                <ul className="divide-y divide-[#e8b4c0]/60">
                  {shown.map((request) => (
                    <RequestRow
                      key={request.request_id}
                      request={request}
                      engineerId={engineerId}
                      ward={tab === "wards"}
                      editing={editing === request.request_id}
                      onEdit={() =>
                        setEditing((current) =>
                          current === request.request_id
                            ? null
                            : request.request_id,
                        )
                      }
                      onSaved={reload}
                    />
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
