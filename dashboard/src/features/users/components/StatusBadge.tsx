import type { UserStatus } from "../api";
import { STATUS_BADGES } from "../userHelpers";

export default function StatusBadge({ status }: { status: UserStatus }) {
  const badge = STATUS_BADGES[status];
  return (
    <span
      className={`inline-flex rounded-md px-3 py-1 text-base font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}
