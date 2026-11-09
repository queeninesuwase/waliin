"use client";

import { CheckCircle2, Circle, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
  errorMessage,
  getFaultRecords,
  logRepair,
  logTest,
  releaseChecklist,
  returnToService,
  statusLabel,
  TEST_TYPES,
  type RepairRecord,
  type TestType,
} from "@/lib/api/maintenance";

export type WorkTarget = {
  faultId: string;
  equipmentName: string;
  assetTag: string;
  department: string;
  status: string;
};

type Tab = "repair" | "test" | "release";

const FIELD =
  "w-full rounded-lg border border-[#e8b4c0] bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-[#650d2f] focus:outline-none";

function when(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function recordTitle(record: RepairRecord) {
  if (record.released_at || record.record_type === "release")
    return "Returned to service";
  if (record.record_type === "repair") return "Repair logged";
  const test = TEST_TYPES.find((item) => item.value === record.record_type);
  return test ? test.label : statusLabel(record.record_type);
}

export default function WorkPanel({
  target,
  engineerId,
  onClose,
  onReleased,
}: {
  target: WorkTarget;
  engineerId: string;
  onClose: () => void;
  onReleased: () => void;
}) {
  const [records, setRecords] = useState<RepairRecord[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab>("repair");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const [work, setWork] = useState("");
  const [parts, setParts] = useState("");
  const [started, setStarted] = useState("");
  const [completed, setCompleted] = useState("");
  const [testType, setTestType] = useState<TestType>("functional_test");
  const [testResult, setTestResult] = useState<"pass" | "fail">("pass");
  const [testDetails, setTestDetails] = useState("");
  const [releaseNote, setReleaseNote] = useState("");

  useEffect(() => {
    let active = true;
    getFaultRecords(target.faultId).then(
      (rows) => {
        if (active) setRecords(rows);
      },
      (err: unknown) => {
        if (active)
          setLoadError(errorMessage(err, "Could not load the work history."));
      },
    );
    return () => {
      active = false;
    };
  }, [target.faultId, attempt]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const checklist = releaseChecklist(records ?? []);

  function reload() {
    setLoadError("");
    setAttempt((count) => count + 1);
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ kind: "ok", text: success });
      reload();
      return true;
    } catch (err) {
      setNotice({
        kind: "error",
        text: errorMessage(err, "That did not work. Try again."),
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitRepair(event: FormEvent) {
    event.preventDefault();
    if (!work.trim()) {
      setNotice({ kind: "error", text: "Describe the work you did." });
      return;
    }
    const saved = await run(
      () =>
        logRepair(target.faultId, engineerId, {
          work_performed: work.trim(),
          parts_used: parts.trim() || null,
          repair_started_at: started ? new Date(started).toISOString() : null,
          repair_completed_at: completed
            ? new Date(completed).toISOString()
            : null,
        }),
      "Repair saved. Now record the tests.",
    );
    if (saved) {
      setWork("");
      setParts("");
      setStarted("");
      setCompleted("");
      setTab("test");
    }
  }

  async function submitTest(event: FormEvent) {
    event.preventDefault();
    const saved = await run(
      () =>
        logTest(target.faultId, engineerId, {
          record_type: testType,
          test_result: testResult,
          test_details: testDetails.trim() || null,
        }),
      testResult === "pass"
        ? "Test saved as passed."
        : "Test saved as failed. The machine stays out of service.",
    );
    if (saved) setTestDetails("");
  }

  async function submitRelease(event: FormEvent) {
    event.preventDefault();
    const saved = await run(
      () =>
        returnToService(
          target.faultId,
          engineerId,
          releaseNote,
          checklist.released,
        ),
      "The machine is back in use.",
    );
    if (saved) onReleased();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Work on ${target.equipmentName}`}
        className="relative flex h-full w-full max-w-xl flex-col bg-[#fbfaf7] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#e8b4c0] bg-white px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-[#b07f00] uppercase">
              Repair and return to service
            </p>
            <h2 className="mt-1 truncate text-xl font-bold text-[#650d2f]">
              {target.equipmentName}
            </h2>
            <p className="text-sm text-gray-500">
              {target.assetTag} · {target.department} ·{" "}
              {statusLabel(target.status)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <ol
            className="grid grid-cols-3 gap-2"
            aria-label="Return to service checklist"
          >
            {[
              { done: checklist.repaired, label: "Repair logged" },
              { done: checklist.functional, label: "Functional test passed" },
              { done: checklist.safety, label: "Safety test passed" },
            ].map((step) => (
              <li
                key={step.label}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center text-xs font-medium ${
                  step.done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-[#e8b4c0] bg-white text-gray-500"
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Circle className="h-5 w-5" aria-hidden="true" />
                )}
                {step.label}
              </li>
            ))}
          </ol>

          <div
            role="tablist"
            className="mt-5 flex gap-1 rounded-lg bg-white p-1 ring-1 ring-[#e8b4c0]"
          >
            {(
              [
                ["repair", "Log repair"],
                ["test", "Record test"],
                ["release", "Return to service"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => {
                  setTab(value);
                  setNotice(null);
                }}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${
                  tab === value
                    ? "bg-[#650d2f] text-white"
                    : "text-gray-600 hover:text-[#650d2f]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {notice && (
            <p
              role={notice.kind === "error" ? "alert" : "status"}
              className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                notice.kind === "error"
                  ? "bg-[#e8b4c0]/30 text-[#650d2f]"
                  : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {notice.text}
            </p>
          )}

          {tab === "repair" && (
            <form onSubmit={submitRepair} className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
                Work performed
                <textarea
                  rows={3}
                  value={work}
                  onChange={(event) => setWork(event.target.value)}
                  placeholder="For example: cleaned and re-seated the speaker connector."
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
                Parts used{" "}
                <span className="font-normal text-gray-500">(optional)</span>
                <input
                  value={parts}
                  onChange={(event) => setParts(event.target.value)}
                  placeholder="For example: 1 × speaker module"
                  className={FIELD}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
                  Started
                  <input
                    type="datetime-local"
                    value={started}
                    onChange={(event) => setStarted(event.target.value)}
                    className={FIELD}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
                  Completed
                  <input
                    type="datetime-local"
                    value={completed}
                    onChange={(event) => setCompleted(event.target.value)}
                    className={FIELD}
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="h-11 rounded-lg bg-[#650d2f] text-sm font-semibold text-white hover:bg-[#4e0a25] disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save repair"}
              </button>
            </form>
          )}

          {tab === "test" && (
            <form onSubmit={submitTest} className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
                Test type
                <select
                  value={testType}
                  onChange={(event) =>
                    setTestType(event.target.value as TestType)
                  }
                  className={FIELD}
                >
                  {TEST_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold text-gray-900">
                  Result
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["pass", "fail"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={testResult === value}
                      onClick={() => setTestResult(value)}
                      className={`h-11 rounded-lg border text-sm font-semibold ${
                        testResult === value
                          ? value === "pass"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                            : "border-red-600 bg-red-50 text-red-700"
                          : "border-[#e8b4c0] bg-white text-gray-600"
                      }`}
                    >
                      {value === "pass" ? "Passed" : "Failed"}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
                Details{" "}
                <span className="font-normal text-gray-500">(optional)</span>
                <textarea
                  rows={3}
                  value={testDetails}
                  onChange={(event) => setTestDetails(event.target.value)}
                  placeholder="Readings, tester used, or what failed."
                  className={FIELD}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="h-11 rounded-lg bg-[#650d2f] text-sm font-semibold text-white hover:bg-[#4e0a25] disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save test result"}
              </button>
            </form>
          )}

          {tab === "release" && (
            <form onSubmit={submitRelease} className="mt-4 flex flex-col gap-4">
              <p className="text-sm text-gray-600">
                A machine goes back into use only after its latest functional
                and electrical safety tests passed.
              </p>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
                Note{" "}
                <span className="font-normal text-gray-500">(optional)</span>
                <textarea
                  rows={2}
                  value={releaseNote}
                  onChange={(event) => setReleaseNote(event.target.value)}
                  placeholder="For example: handed back to the ward nurse in charge."
                  className={FIELD}
                />
              </label>
              <button
                type="submit"
                disabled={busy || !(checklist.functional && checklist.safety)}
                className="h-11 rounded-lg bg-[#d9a00a] text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Saving..." : "Mark back in use"}
              </button>
              {!(checklist.functional && checklist.safety) && (
                <p className="text-xs text-gray-500">
                  Record a passed functional test and a passed safety test
                  first.
                </p>
              )}
            </form>
          )}

          <section className="mt-8">
            <h3 className="text-sm font-bold tracking-wide text-[#650d2f] uppercase">
              Work history
            </h3>
            {loadError && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#e8b4c0]/30 px-4 py-3 text-sm text-[#650d2f]">
                {loadError}
                <button
                  type="button"
                  onClick={reload}
                  className="font-semibold underline"
                >
                  Retry
                </button>
              </div>
            )}
            {!records && !loadError && (
              <p className="mt-3 text-sm text-gray-500">Loading...</p>
            )}
            {records && records.length === 0 && (
              <p className="mt-3 text-sm text-gray-500">
                No work recorded yet.
              </p>
            )}
            {records && records.length > 0 && (
              <ol className="mt-3 flex flex-col gap-3 border-l-2 border-[#e8b4c0] pl-4">
                {[...records]
                  .sort(
                    (a, b) =>
                      Date.parse(b.performed_at) - Date.parse(a.performed_at),
                  )
                  .map((record) => (
                    <li key={record.record_id} className="relative">
                      <span
                        className={`absolute top-1.5 -left-[23px] h-3 w-3 rounded-full ring-2 ring-[#fbfaf7] ${
                          record.test_result === "fail"
                            ? "bg-red-600"
                            : record.test_result === "pass" ||
                                record.released_at
                              ? "bg-emerald-500"
                              : "bg-[#650d2f]"
                        }`}
                      />
                      <p className="text-sm font-semibold text-gray-900">
                        {recordTitle(record)}
                        {record.test_result && (
                          <span
                            className={`ml-2 text-xs font-semibold ${
                              record.test_result === "pass"
                                ? "text-emerald-700"
                                : "text-red-700"
                            }`}
                          >
                            {record.test_result === "pass"
                              ? "Passed"
                              : "Failed"}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {when(record.performed_at)}
                      </p>
                      {(record.work_performed || record.test_details) && (
                        <p className="mt-1 text-sm text-gray-700">
                          {record.work_performed ?? record.test_details}
                        </p>
                      )}
                      {record.parts_used && (
                        <p className="text-xs text-gray-500">
                          Parts: {record.parts_used}
                        </p>
                      )}
                    </li>
                  ))}
              </ol>
            )}
          </section>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[#e8b4c0] bg-white px-6 py-4">
          <Link
            href={`/biomedical-engineer/faults/${target.faultId}`}
            className="flex items-center gap-2 text-sm font-semibold text-[#650d2f] hover:underline"
          >
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Open fault details
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-[#e8b4c0] px-4 text-sm font-semibold text-gray-700"
          >
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
}
