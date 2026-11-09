"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import AppShell from "@/components/AppShell";
import { CurrentUser } from "@/lib/session";
import { Icon } from "@/components/waliin/ui";
import styles from "@/components/waliin/waliin.module.css";
import {
  ROUTES,
  URGENCY_OPTIONS,
  Urgency,
  checkEquipmentRequest,
  createEquipmentRequest,
  messageOf,
  requestJustification,
  requestRef,
} from "@/lib/waliin";

type Step = "form" | "review" | "done";

type FormValues = {
  item: string;
  quantity: string;
  reason: string;
  patients: string;
  urgency: Urgency;
};

function Flow({
  user,
  step,
  setStep,
}: {
  user: CurrentUser;
  step: Step;
  setStep: (s: Step) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reference, setReference] = useState("");

  const {
    register,
    handleSubmit,
    control,
    getValues,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      item: "",
      quantity: "1",
      reason: "",
      patients: "",
      urgency: "soon",
    },
  });
  const values = useWatch({ control });

  function toInput(v: FormValues) {
    return {
      item: v.item,
      quantity: Number(v.quantity),
      reason: v.reason,
      patients: v.patients.trim() === "" ? -1 : Number(v.patients),
    };
  }

  function goReview(v: FormValues) {
    const problem = checkEquipmentRequest(toInput(v));
    if (problem) {
      setError("root", { message: problem });
      return;
    }
    setSubmitError("");
    setStep("review");
  }

  async function submit() {
    const v = getValues();
    const input = toInput(v);
    setSubmitting(true);
    setSubmitError("");
    try {
      const created = await createEquipmentRequest(user.user_id, {
        item: input.item,
        quantity: input.quantity,
        justification: requestJustification({
          reason: input.reason,
          patients: input.patients,
          urgency: v.urgency,
        }),
      });
      setReference(requestRef(created));
      setStep("done");
    } catch (e) {
      setSubmitError(
        `Your request was not sent. ${messageOf(e)} Your answers are kept, so you can try again.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startAgain() {
    reset();
    setReference("");
    setSubmitError("");
    setStep("form");
  }

  if (step === "done") {
    return (
      <div className={styles.center}>
        <div className={styles.bigCheck}>
          <Icon name="check" size={26} />
        </div>
        <h2>Equipment request sent</h2>
        <p>
          Your request {reference} was sent. The biomedical engineer adds the
          technical requirements, then the health manager decides and contacts
          donors or suppliers.
        </p>
        <div className={styles.btnRowCenter}>
          <Link href={ROUTES.equipmentRequests} className={styles.primary}>
            View equipment requests
          </Link>
          <button type="button" className={styles.ghost} onClick={startAgain}>
            Request something else
          </button>
        </div>
      </div>
    );
  }

  if (step === "review") {
    const urgency =
      URGENCY_OPTIONS.find((o) => o.value === values.urgency)?.label ?? "";
    const rows: [string, string, "monitor" | "file" | "users" | "clock"][] = [
      [
        "Equipment",
        `${(values.item ?? "").trim()} × ${values.quantity ?? "1"}`,
        "monitor",
      ],
      ["Why it is needed", (values.reason ?? "").trim(), "file"],
      ["Patients each week", values.patients ?? "", "users"],
      ["Urgency", urgency, "clock"],
    ];
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
                : "Send request"}
          </button>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit(goReview)} noValidate>
      <div className={styles.card}>
        <label className={styles.label} htmlFor="item">
          Equipment needed *
        </label>
        <input
          id="item"
          className={styles.field}
          placeholder="For example: fetal monitor"
          {...register("item")}
        />

        <label className={styles.label} htmlFor="quantity">
          How many *
        </label>
        <input
          id="quantity"
          type="number"
          min={1}
          className={styles.field}
          {...register("quantity")}
        />

        <label className={styles.label} htmlFor="reason">
          Why does your department need it? *
        </label>
        <textarea
          id="reason"
          className={styles.textarea}
          maxLength={1000}
          placeholder="For example: we have one fetal monitor for 12 beds, so mothers wait to be monitored."
          {...register("reason")}
        />

        <label className={styles.label} htmlFor="patients">
          Patients it would serve each week *
        </label>
        <input
          id="patients"
          type="number"
          min={0}
          className={styles.field}
          placeholder="For example: 30"
          {...register("patients")}
        />
      </div>

      <div className={styles.card}>
        <span className={styles.label}>Urgency *</span>
        {URGENCY_OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`${styles.option} ${values.urgency === o.value ? styles.optionOn : ""}`}
          >
            <input type="radio" value={o.value} {...register("urgency")} />
            {o.label}
          </label>
        ))}
        {errors.root?.message && (
          <div role="alert" className={styles.error}>
            {errors.root.message}
          </div>
        )}
        <button type="submit" className={`${styles.primary} ${styles.sendGap}`}>
          Review request
        </button>
      </div>
    </form>
  );
}

export default function NewEquipmentRequestPage() {
  const [step, setStep] = useState<Step>("form");
  return (
    <AppShell
      active="equipment"
      title={
        step === "review" ? "Review equipment request" : "Request equipment"
      }
    >
      {(user) => <Flow user={user} step={step} setStep={setStep} />}
    </AppShell>
  );
}
