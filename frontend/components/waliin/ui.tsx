import styles from "./waliin.module.css";
import { StatusLabel } from "@/lib/waliin";

const PATHS: Record<string, string> = {
  wrench:
    "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z",
  clipboard: "M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h6",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  file: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6",
  alert: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16v.5",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  users:
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
};

export function Icon({
  name,
  size = 18,
}: {
  name: keyof typeof PATHS;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

const CHIP: Record<StatusLabel, string> = {
  Received: styles.chipSubmitted,
  "In repair": styles.chipInProgress,
  "Waiting for part": styles.chipInProgress,
  "Back in use": styles.chipResolved,
  Closed: styles.chipRejected,
};

export function StatusChip({ status }: { status: StatusLabel }) {
  return <span className={`${styles.chip} ${CHIP[status]}`}>{status}</span>;
}

const REQUEST_CHIP: Record<string, string> = {
  Submitted: styles.chipSubmitted,
  "Under review": styles.chipInProgress,
  "More detail needed": styles.chipInProgress,
  Approved: styles.chipInProgress,
  "Sent to donors": styles.chipInProgress,
  Received: styles.chipResolved,
  Declined: styles.chipRejected,
};

export function RequestChip({ label }: { label: string }) {
  return (
    <span
      className={`${styles.chip} ${REQUEST_CHIP[label] ?? styles.chipSubmitted}`}
    >
      {label}
    </span>
  );
}

export function ErrorBanner({
  message,
  onRetry,
  busy = false,
  kept = false,
}: {
  message: string;
  onRetry: () => void;
  busy?: boolean;
  kept?: boolean;
}) {
  return (
    <div role="alert" className={styles.banner}>
      <span>
        {message}
        {kept ? " Showing what was loaded before." : ""}
      </span>
      <button type="button" onClick={onRetry} disabled={busy}>
        {busy ? "Retrying..." : "Retry"}
      </button>
    </div>
  );
}
