"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { ErrorBox, Loading } from "@/components/requests/Feedback";
import { CurrentUser } from "@/lib/session";
import { ErrorBanner, Icon, StatusChip } from "@/components/waliin/ui";
import styles from "@/components/waliin/waliin.module.css";
import {
  ApiError,
  Equipment,
  Fault,
  ROUTES,
  StatusLabel,
  WorkRecord,
  displayName,
  equipmentLabel,
  equipmentName,
  fetchEquipmentMap,
  fetchFault,
  fetchWorkRecords,
  fmtDateTime,
  messageOf,
  outOfServiceFor,
  refOf,
  severityLabel,
  statusOf,
} from "@/lib/waliin";

type Step = { title: string; when?: string; note?: string; pending?: boolean };

const TEST_NAMES: Record<string, string> = {
  functional_test: "Functional test",
  safety_test: "Electrical safety test",
  calibration: "Calibration",
  performance_test: "Performance test",
  commissioning: "Commissioning",
};

const STATUS_TEXT: Record<StatusLabel, string> = {
  Received:
    "Your report has reached the biomedical engineer. They will check the machine.",
  "In repair":
    "The engineer is working on the machine. It goes back into use only after it passes a test.",
  "Waiting for part":
    "The machine needs a spare part or outside help. The health manager has been asked for it.",
  "Back in use": "The machine passed its test and is back in use.",
  Closed:
    "The engineer closed this report without a repair, for example because the machine was working.",
};

function timelineOf(f: Fault, reporter: string, records: WorkRecord[]): Step[] {
  const steps: Step[] = [
    {
      title: "Report received",
      when: f.reported_at,
      note: reporter ? `By ${reporter}` : undefined,
    },
  ];
  if (f.assigned_engineer_id) steps.push({ title: "Engineer assigned" });
  if (f.out_of_service_at) {
    steps.push({ title: "Marked out of service", when: f.out_of_service_at });
  }
  const work = [...records].sort(
    (a, b) => Date.parse(a.performed_at) - Date.parse(b.performed_at),
  );
  for (const r of work) {
    if (r.record_type === "repair") {
      steps.push({ title: "Repair done", when: r.performed_at });
    } else if (r.record_type !== "release" && !r.released_at) {
      steps.push({
        title: `${TEST_NAMES[r.record_type] ?? r.record_type.replace(/_/g, " ")} ${
          r.test_result === "pass" ? "passed" : "failed"
        }`,
        when: r.performed_at,
      });
    }
  }
  const label = statusOf(f);
  if (label === "Back in use") {
    steps.push({ title: "Back in use", when: f.closed_at ?? f.updated_at });
  } else if (label === "Closed") {
    steps.push({
      title: "Closed without repair",
      when: f.closed_at ?? f.updated_at,
    });
  } else if (label === "Waiting for part") {
    steps.push({
      title: "Waiting for a spare part",
      when: f.updated_at,
      pending: true,
    });
  } else if (label === "In repair") {
    steps.push({ title: "In repair", when: f.updated_at, pending: true });
  }
  return steps;
}

function Content({ user }: { user: CurrentUser }) {
  const { id } = useParams<{ id: string }>();
  const [fault, setFault] = useState<Fault | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [recordsFailed, setRecordsFailed] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const f = await fetchFault(id);
        const [map, work] = await Promise.all([
          fetchEquipmentMap([f.equipment_id]),
          fetchWorkRecords(id).then(
            (list) => ({ list, failed: false }),
            () => ({ list: [] as WorkRecord[], failed: true }),
          ),
        ]);
        if (!alive) return;
        setFault(f);
        setEquipment(map.get(f.equipment_id) ?? null);
        setRecords((old) => (work.failed ? old : work.list));
        setRecordsFailed(work.failed);
        setError("");
      } catch (e) {
        if (!alive) return;
        if (e instanceof ApiError && (e.status === 404 || e.status === 422)) {
          setNotFound(true);
        }
        setError(messageOf(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  if (notFound && !fault) {
    return (
      <div className={styles.center}>
        <h2>This fault report could not be found</h2>
        <p>It may have been removed, or the link is wrong.</p>
        <Link href={ROUTES.requests} className={styles.primary}>
          Back to my fault reports
        </Link>
      </div>
    );
  }
  if (error && !fault) {
    return (
      <ErrorBox
        title="Could not load this fault report"
        message={error}
        onRetry={retry}
      />
    );
  }
  if (!fault) return <Loading />;

  const reporter = fault.reported_by === user.user_id ? displayName(user) : "";
  const label = statusOf(fault);
  const [title, ...details] = fault.description.split("\n");

  return (
    <>
      <h2 className={styles.detailTitle}>{refOf(fault.fault_id)}</h2>
      <div style={{ marginBottom: "0.75rem" }}>
        <StatusChip status={label} />
      </div>
      <p className={styles.hint}>
        {STATUS_TEXT[label]}
        {fault.out_of_service_at &&
        label !== "Back in use" &&
        label !== "Closed"
          ? ` Out of service ${outOfServiceFor(fault.out_of_service_at)}.`
          : ""}
      </p>

      {error && (
        <ErrorBanner
          message="Could not refresh this report."
          onRetry={retry}
          busy={loading}
          kept
        />
      )}
      {!error && recordsFailed && (
        <ErrorBanner
          message="Could not load the repair and test history."
          onRetry={retry}
          busy={loading}
        />
      )}

      <div className={styles.detailGrid}>
        <div className={styles.card}>
          <div className={styles.reviewRow}>
            <span className={styles.reviewIcon}>
              <Icon name="monitor" size={14} />
            </span>
            <div className={styles.reviewText}>
              <small>Equipment</small>
              {equipment ? equipmentLabel(equipment) : equipmentName(equipment)}
              {equipment?.location ? ` · ${equipment.location}` : ""}
            </div>
          </div>
          <div className={styles.reviewRow}>
            <span className={styles.reviewIcon}>
              <Icon name="alert" size={14} />
            </span>
            <div className={styles.reviewText}>
              <small>Problem</small>
              {title}
              {details.map((line) => (
                <span key={line} style={{ display: "block" }}>
                  {line}
                </span>
              ))}
            </div>
          </div>
          <div className={styles.reviewRow}>
            <span className={styles.reviewIcon}>
              <Icon name="clock" size={14} />
            </span>
            <div className={styles.reviewText}>
              <small>Effect on patients</small>
              {severityLabel(fault.severity)}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h3 style={{ fontSize: "0.85rem", marginTop: 0 }}>Timeline</h3>
          <ul className={styles.timeline}>
            {timelineOf(fault, reporter, records).map((s, i) => (
              <li
                key={`${s.title}-${i}`}
                className={s.pending ? styles.pending : ""}
              >
                <strong>{s.title}</strong>
                {s.when && <span>{fmtDateTime(s.when)}</span>}
                {s.note && <span>{s.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export default function RequestDetailPage() {
  return (
    <AppShell active="requests" title="Fault report">
      {(user) => <Content user={user} />}
    </AppShell>
  );
}
