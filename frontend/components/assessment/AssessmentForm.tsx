"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { createAssessment, type PriorityLevel } from "@/lib/api/faults";
import { assessmentErrorMessage } from "./messages";

type AssessmentFormProps = {
  faultId: string;
  engineerId: string;
  onAssessmentSaved?: () => void;
};

type AssessmentFormValues = {
  findings: string;
  condition: string;
  recommendedAction: string;
  severityFactor: number;
  clinicalCriticality: number;
  backupAvailable: "true" | "false";
  priorityLevel: PriorityLevel;
  priorityExplanation: string;
};

export default function AssessmentForm({
  faultId,
  engineerId,
  onAssessmentSaved,
}: AssessmentFormProps) {
  const [message, setMessage] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssessmentFormValues>({
    defaultValues: {
      findings: "",
      condition: "",
      recommendedAction: "",
      severityFactor: 1,
      clinicalCriticality: 1,
      backupAvailable: "true",
      priorityLevel: "low",
      priorityExplanation: "",
    },
  });

  async function onSubmit(values: AssessmentFormValues) {
    setMessage("");

    try {
      const data = await createAssessment(faultId, engineerId, {
        findings: values.findings.trim(),
        condition: values.condition.trim(),
        recommended_action: values.recommendedAction.trim(),
        severity_factor: Number(values.severityFactor),
        clinical_criticality: Number(values.clinicalCriticality),
        backup_available: values.backupAvailable === "true",
        priority_level: values.priorityLevel,
        priority_explanation: values.priorityExplanation.trim(),
      });

      setMessage(
        `Assessment saved. Score: ${data.priority_score}, rule priority: ${data.rule_priority_level}. The machine is now on the priority list.`,
      );

      onAssessmentSaved?.();

      reset();
    } catch (error) {
      setMessage(
        assessmentErrorMessage(error, "Could not save the assessment."),
      );
    }
  }

  const fieldClass =
    "w-full rounded-md border border-[#e4b6c3] bg-white px-3 py-2.5 text-[12px] text-[#263346] outline-none placeholder:text-[#b2b8c0] focus:border-brand";

  const labelClass = "mb-1.5 block text-[11px] font-medium text-[#263346]";

  const errorClass = "mt-1 text-[10px] text-red-600";

  return (
    <section className="rounded-[10px] border border-[#e4b6c3] bg-white p-4">
      <div className="mb-5">
        <h2 className="text-[16px] font-bold text-[#263346]">
          Equipment assessment
        </h2>

        <p className="mt-1 text-[11px] leading-4 text-[#7b8796]">
          Assess the reported equipment fault and assign a priority.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className={labelClass}>Findings</label>

          <textarea
            {...register("findings", {
              required: "Findings are required",
            })}
            rows={3}
            className={fieldClass}
            placeholder="Describe what you found during assessment"
          />

          {errors.findings && (
            <p className={errorClass}>{errors.findings.message}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Condition</label>

          <input
            {...register("condition", {
              required: "Condition is required",
              maxLength: {
                value: 80,
                message: "Condition must be 80 characters or fewer",
              },
            })}
            className={fieldClass}
            placeholder="Example: Out of service"
          />

          {errors.condition && (
            <p className={errorClass}>{errors.condition.message}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Recommended action</label>

          <textarea
            {...register("recommendedAction", {
              required: "Recommended action is required",
            })}
            rows={3}
            className={fieldClass}
            placeholder="Describe the recommended repair or follow-up"
          />

          {errors.recommendedAction && (
            <p className={errorClass}>{errors.recommendedAction.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Severity</label>

            <select
              {...register("severityFactor", {
                valueAsNumber: true,
              })}
              className={fieldClass}
            >
              <option value={1}>1 - Low</option>
              <option value={2}>2 - Moderate</option>
              <option value={3}>3 - High</option>
              <option value={4}>4 - Critical</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Clinical criticality</label>

            <select
              {...register("clinicalCriticality", {
                valueAsNumber: true,
              })}
              className={fieldClass}
            >
              <option value={1}>1 - Low</option>
              <option value={2}>2 - Medium</option>
              <option value={3}>3 - High</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Backup available</label>

          <div className="flex gap-5 text-[12px] text-[#263346]">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="true"
                {...register("backupAvailable")}
                className="accent-[#82062f]"
              />
              Yes
            </label>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="false"
                {...register("backupAvailable")}
                className="accent-[#82062f]"
              />
              No
            </label>
          </div>
        </div>

        <div>
          <label className={labelClass}>Final priority</label>

          <select {...register("priorityLevel")} className={fieldClass}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Priority explanation</label>

          <textarea
            {...register("priorityExplanation", {
              required: "Priority explanation is required",
            })}
            rows={3}
            className={fieldClass}
            placeholder="Explain why this priority was selected"
          />

          {errors.priorityExplanation && (
            <p className={errorClass}>{errors.priorityExplanation.message}</p>
          )}
        </div>

        {message && (
          <div className="rounded-md bg-[#fff1cf] px-3 py-2 text-[11px] text-[#8b6500]">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-[49px] w-full rounded-sm bg-brand text-[13px] font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Submit assessment"}
        </button>
      </form>
    </section>
  );
}
