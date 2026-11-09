"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import AppShell from "@/components/AppShell";
import { Empty, ErrorBox, Loading } from "@/components/requests/Feedback";
import { CurrentUser } from "@/lib/session";
import { Icon } from "@/components/waliin/ui";
import styles from "@/components/waliin/waliin.module.css";
import {
  Equipment,
  PROBLEM_OPTIONS,
  Problem,
  ROUTES,
  SEVERITY_OPTIONS,
  Severity,
  USABILITY_OPTIONS,
  Usability,
  checkFaultReport,
  createFault,
  equipmentLabel,
  faultDescription,
  fetchEquipmentOptions,
  matchesEquipment,
  messageOf,
  refOf,
  severityLabel,
  usabilityLabel,
} from "@/lib/waliin";

type Step = "form" | "review" | "done";

type FormValues = {
  equipment_id: string;
  problem: Problem | "";
  note: string;
  usable: Usability;
  impact: string;
  severity: Severity;
};

function newReportId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (
      Number(c) ^
      (Math.floor(Math.random() * 256) & (15 >> (Number(c) / 4)))
    ).toString(16),
  );
}

function Flow({
  user,
  step,
  setStep,
}: {
  user: CurrentUser;
  step: Step;
  setStep: (s: Step) => void;
}) {
  const [options, setOptions] = useState<Equipment[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdRef, setCreatedRef] = useState("");
  const reportId = useRef(newReportId());

  const {
    register,
    handleSubmit,
    control,
    getValues,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      equipment_id: "",
      problem: "",
      note: "",
      usable: "no",
      impact: "",
      severity: "medium",
    },
  });
  const values = useWatch({ control });

  const departmentId = user.department_id ?? null;

  useEffect(() => {
    let alive = true;
    fetchEquipmentOptions(departmentId)
      .then((result) => {
        if (!alive) return;
        setOptions(result);
        setLoadError("");
        const wanted = new URLSearchParams(window.location.search).get(
          "equipment",
        );
        if (wanted && result.some((e) => e.equipment_id === wanted)) {
          setValue("equipment_id", wanted);
        }
      })
      .catch((e) => {
        if (alive) setLoadError(messageOf(e));
      });
    return () => {
      alive = false;
    };
  }, [departmentId, attempt, setValue]);

  const retry = useCallback(() => {
    setLoadError("");
    setAttempt((n) => n + 1);
  }, []);

  const list = useMemo(() => options ?? [], [options]);
  const chosen = list.find((e) => e.equipment_id === values.equipment_id);
  const shown = useMemo(() => {
    const matches = list.filter((e) => matchesEquipment(e, search));
    if (chosen && !matches.includes(chosen)) return [chosen, ...matches];
    return matches;
  }, [list, search, chosen]);

  function goReview(v: FormValues) {
    const problem = checkFaultReport({
      equipment_id: v.equipment_id,
      problem: v.problem,
      note: v.note,
    });
    if (problem) {
      setError("root", { message: problem });
      return;
    }
    setSubmitError("");
    setStep("review");
  }

  async function submit() {
    const v = getValues();
    if (!v.problem) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const created = await createFault({
        equipment_id: v.equipment_id,
        reported_by: user.user_id,
        description: faultDescription({
          problem: v.problem,
          note: v.note,
          usable: v.usable,
          impact: v.impact,
        }),
        severity: v.severity,
        client_report_id: reportId.current,
      });
      setCreatedRef(refOf(created.fault_id));
      setStep("done");
    } catch (e) {
      setSubmitError(
        `Your report was not sent. ${messageOf(e)} Your answers are kept, so you can try again.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startAgain() {
    reset();
    reportId.current = newReportId();
    setSearch("");
    setCreatedRef("");
    setSubmitError("");
    setStep("form");
  }

  if (step === "done") {
    return (
      <div className={styles.center}>
        <div className={styles.bigCheck}>
          <Icon name="check" size={26} />
        </div>
        <h2>Fault reported</h2>
        <p>
          Your report {createdRef} has reached the biomedical engineer. You can
          follow its status in My fault reports.
        </p>
        <div className={styles.btnRowCenter}>
          <Link href={ROUTES.requests} className={styles.primary}>
            View my fault reports
          </Link>
          <button type="button" className={styles.ghost} onClick={startAgain}>
            Report another fault
          </button>
        </div>
      </div>
    );
  }

  if (loadError && !options) {
    return (
      <ErrorBox
        title="Could not load the machines in your department"
        message={loadError}
        onRetry={retry}
      />
    );
  }
  if (!options) return <Loading />;

  if (step === "review" && chosen && values.problem) {
    const rows: [string, string, "monitor" | "alert" | "clock" | "file"][] = [
      ["Machine", equipmentLabel(chosen), "monitor"],
      [
        "What is wrong",
        faultDescription({
          problem: values.problem,
          note: values.note ?? "",
          usable: values.usable ?? "no",
          impact: "",
        }).split("\n")[0],
        "alert",
      ],
      ["Can it still be used", usabilityLabel(values.usable ?? "no"), "alert"],
      [
        "Effect on patients",
        severityLabel(values.severity ?? "medium"),
        "clock",
      ],
    ];
    if ((values.impact ?? "").trim()) {
      rows.push([
        "More about the effect",
        (values.impact ?? "").trim(),
        "file",
      ]);
    }
    return (
      <>
        <div className={styles.card}>
          {rows.map(([title, value, icon]) => (
            <div className={styles.reviewRow} key={title}>
              <span className={styles.reviewIcon}>
                <Icon name={icon} size={14} />
              </span>
              <div className={styles.reviewText}>
                <small>{title}</small>
                {value}
              </div>
              <button
                type="button"
                className={styles.edit}
                onClick={() => setStep("form")}
              >
                Edit
              </button>
            </div>
          ))}
        </div>
        {submitError && (
          <div role="alert" className={styles.banner}>
            <span>{submitError}</span>
          </div>
        )}
        <div className={styles.btnRow}>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => setStep("form")}
            disabled={submitting}
          >
            Back to edit
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={submit}
            disabled={submitting}
          >
            {submitting
              ? "Sending..."
              : submitError
                ? "Try again"
                : "Send report"}
          </button>
        </div>
      </>
    );
  }

  if (list.length === 0) {
    return (
      <Empty title="No machines to report on yet">
        Only approved machines in your department can be reported. Ask your
        biomedical engineer to register the machine and the health manager to
        approve it.
      </Empty>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(goReview)}
      noValidate
      className="grid items-start gap-x-6 xl:grid-cols-2"
    >
      <div className={styles.card}>
        <label className={styles.label} htmlFor="equipment-search">
          Machine *
        </label>
        <input
          id="equipment-search"
          type="search"
          className={`${styles.field} ${styles.searchField}`}
          placeholder="Search by name or asset tag"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          id="equipment"
          aria-label="Machine"
          className={styles.field}
          {...register("equipment_id")}
        >
          <option value="">
            {shown.length === 0
              ? "No machine matches your search"
              : `Choose a machine (${shown.length})`}
          </option>
          {shown.map((e) => (
            <option key={e.equipment_id} value={e.equipment_id}>
              {equipmentLabel(e)}
              {e.location ? ` · ${e.location}` : ""}
            </option>
          ))}
        </select>

        <span className={styles.label}>What is wrong? *</span>
        <div
          className={styles.chips}
          role="radiogroup"
          aria-label="What is wrong"
        >
          {PROBLEM_OPTIONS.map((p) => (
            <label
              key={p}
              className={`${styles.chipOption} ${values.problem === p ? styles.chipOptionOn : ""}`}
            >
              <input type="radio" value={p} {...register("problem")} />
              {p}
            </label>
          ))}
        </div>

        <label className={styles.label} htmlFor="note">
          {values.problem === "Other"
            ? "Describe the problem *"
            : "Short note (optional)"}
        </label>
        <textarea
          id="note"
          className={styles.textarea}
          maxLength={500}
          placeholder="For example: shows error E-04 after 5 minutes."
          {...register("note")}
        />
        <p className={styles.hint}>Do not write patient names or details.</p>
      </div>

      <div className={styles.card}>
        <span className={styles.label}>Can it still be used? *</span>
        {USABILITY_OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`${styles.option} ${values.usable === o.value ? styles.optionOn : ""}`}
          >
            <input type="radio" value={o.value} {...register("usable")} />
            {o.label}
          </label>
        ))}

        <span className={styles.label}>Effect on patients *</span>
        {SEVERITY_OPTIONS.map((s) => (
          <label
            key={s.value}
            className={`${styles.option} ${values.severity === s.value ? styles.optionOn : ""}`}
          >
            <input type="radio" value={s.value} {...register("severity")} />
            {s.label}
          </label>
        ))}

        <label className={styles.label} htmlFor="impact">
          More about the effect (optional)
        </label>
        <textarea
          id="impact"
          className={styles.textarea}
          maxLength={300}
          placeholder="For example: mothers in labour cannot be monitored."
          {...register("impact")}
        />

        {errors.root?.message && (
          <div role="alert" className={styles.error}>
            {errors.root.message}
          </div>
        )}
        <button type="submit" className={`${styles.primary} ${styles.sendGap}`}>
          Review report
        </button>
      </div>
    </form>
  );
}

export default function NewRequestPage() {
  const [step, setStep] = useState<Step>("form");
  return (
    <AppShell
      active="requests"
      title={step === "review" ? "Check your report" : "Report a fault"}
    >
      {(user) => <Flow user={user} step={step} setStep={setStep} />}
    </AppShell>
  );
}
