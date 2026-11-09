"use client";

import { useEffect, useState } from "react";

import {
  getAssessments,
  type Assessment,
  type PriorityLevel,
} from "@/lib/api/faults";
import { assessmentErrorMessage } from "./messages";

type AssessmentHistoryProps = {
  faultId: string;
  engineerId: string;
  refreshKey?: number;
};

function formatPriority(priority: PriorityLevel) {
  return `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AssessmentHistory({
  faultId,
  engineerId,
  refreshKey = 0,
}: AssessmentHistoryProps) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getAssessments(faultId, engineerId)
      .then((data) => {
        if (!active) return;
        setAssessments(
          [...data].sort(
            (a, b) => Date.parse(b.assessed_at) - Date.parse(a.assessed_at),
          ),
        );
        setError("");
      })
      .catch((err: unknown) => {
        if (active)
          setError(
            assessmentErrorMessage(
              err,
              "Could not load the assessment history.",
            ),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [faultId, engineerId, refreshKey]);

  if (loading) {
    return (
      <section className="rounded-[10px] border border-[#e4b6c3] bg-white p-4">
        <p className="text-[11px] text-[#7b8796]">
          Loading assessment history...
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[10px] border border-[#e4b6c3] bg-white p-4">
      <div className="mb-4">
        <h2 className="text-[16px] font-bold text-[#263346]">
          Assessment history
        </h2>

        <p className="mt-1 text-[11px] text-[#7b8796]">
          Previous assessments for this fault.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-[#fde9e9] px-3 py-2 text-[11px] text-[#d95b64]">
          {error}
        </div>
      )}

      {!error && assessments.length === 0 && (
        <p className="text-[11px] text-[#7b8796]">
          No assessments recorded yet.
        </p>
      )}

      <div className="space-y-3">
        {assessments.map((assessment) => (
          <article
            key={assessment.assessment_id}
            className="rounded-[7px] border border-[#ead7dd] bg-[#fffdfb] p-3"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-bold text-[#263346]">
                  {formatPriority(assessment.priority_level)}
                </p>

                <p className="mt-1 text-[10px] text-[#7b8796]">
                  {formatDate(assessment.assessed_at)}
                </p>
              </div>

              <span
                className={`rounded-sm px-2 py-1 text-[9px] ${
                  assessment.is_current
                    ? "bg-[#fff1cf] text-[#b27b00]"
                    : "bg-[#f1f2f4] text-[#7b8796]"
                }`}
              >
                {assessment.is_current ? "Current" : "Previous"}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-[#7b8796]">Findings</p>
                <p className="mt-1 text-[11px] leading-4 text-[#263346]">
                  {assessment.findings}
                </p>
              </div>

              <div>
                <p className="text-[10px] text-[#7b8796]">Condition</p>
                <p className="mt-1 text-[11px] leading-4 text-[#263346]">
                  {assessment.condition}
                </p>
              </div>

              <div>
                <p className="text-[10px] text-[#7b8796]">Recommended action</p>
                <p className="mt-1 text-[11px] leading-4 text-[#263346]">
                  {assessment.recommended_action}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-[#7b8796]">Priority score</p>
                  <p className="mt-1 text-[11px] text-[#263346]">
                    {assessment.priority_score}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-[#7b8796]">Rule priority</p>
                  <p className="mt-1 text-[11px] capitalize text-[#263346]">
                    {assessment.rule_priority_level}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-[#7b8796]">
                  Priority explanation
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[#263346]">
                  {assessment.priority_explanation}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
