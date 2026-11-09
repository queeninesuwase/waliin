"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Empty, ErrorBox, Loading } from "@/components/requests/Feedback";
import { CurrentUser } from "@/lib/session";
import { ErrorBanner, Icon, StatusChip } from "@/components/waliin/ui";
import { useMyFaults } from "@/components/waliin/useMyFaults";
import styles from "@/components/waliin/waliin.module.css";
import {
  ROUTES,
  STATUS_FILTERS,
  StatusLabel,
  equipmentName,
  faultTitle,
  fmtDate,
  refOf,
  statusOf,
} from "@/lib/waliin";

function Content({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const { rows, error, loading, reload } = useMyFaults(user.user_id);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusLabel | "All">("All");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter(({ fault, equipment }) => {
      if (filter !== "All" && statusOf(fault) !== filter) return false;
      if (!q) return true;
      return [
        refOf(fault.fault_id),
        equipmentName(equipment),
        equipment?.asset_tag ?? "",
        faultTitle(fault),
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [rows, query, filter]);

  if (error && rows === null) {
    return (
      <ErrorBox
        title="Could not load your fault reports"
        message={error}
        onRetry={reload}
      />
    );
  }
  if (rows === null) return <Loading />;

  return (
    <>
      {error && (
        <ErrorBanner
          message="Could not refresh your fault reports."
          onRetry={reload}
          busy={loading}
          kept
        />
      )}

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-2xl text-base text-gray-500">
          Every machine you reported, and where it is now. A machine is back in
          use only after the engineer&apos;s test passes.
        </p>
        <Link
          href={ROUTES.newRequest}
          className="inline-flex items-center gap-2 rounded-xl bg-[#650d2f] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#4e0a25]"
        >
          <Icon name="plus" size={16} /> Report a fault
        </Link>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" size={15} />
          <input
            placeholder="Search by machine, asset tag or problem..."
            aria-label="Search fault reports"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {(["All", ...STATUS_FILTERS] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`${styles.filter} ${filter === f ? styles.filterOn : ""}`}
          >
            {f} (
            {f === "All"
              ? rows.length
              : rows.filter(({ fault }) => statusOf(fault) === f).length}
            )
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty title="No fault reports yet">
          When a machine stops working or behaves strangely, report it and
          follow its status here.
        </Empty>
      ) : shown.length === 0 ? (
        <Empty title="No fault reports found">
          Try a different search or filter.
        </Empty>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Report</th>
                <th>Equipment</th>
                <th>Problem</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ fault, equipment }) => (
                <tr
                  key={fault.fault_id}
                  className={styles.rowLink}
                  tabIndex={0}
                  onClick={() => router.push(ROUTES.request(fault.fault_id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      router.push(ROUTES.request(fault.fault_id));
                    }
                  }}
                >
                  <td>{refOf(fault.fault_id)}</td>
                  <td>{equipmentName(equipment)}</td>
                  <td>{faultTitle(fault)}</td>
                  <td>
                    <StatusChip status={statusOf(fault)} />
                  </td>
                  <td>{fmtDate(fault.reported_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function RequestsPage() {
  return (
    <AppShell active="requests" title="My fault reports">
      {(user) => <Content user={user} />}
    </AppShell>
  );
}
