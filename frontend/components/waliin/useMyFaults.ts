"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Equipment,
  Fault,
  fetchEquipmentMap,
  fetchMyFaults,
  messageOf,
} from "@/lib/waliin";

export type Row = { fault: Fault; equipment: Equipment | null };

export function useMyFaults(userId: string) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mine = await fetchMyFaults(userId, attempt > 0);
        const map = await fetchEquipmentMap([
          ...new Set(mine.map((f) => f.equipment_id)),
        ]);
        if (!alive) return;
        setRows(
          mine.map((fault) => ({
            fault,
            equipment: map.get(fault.equipment_id) ?? null,
          })),
        );
        setError("");
      } catch (e) {
        if (alive) setError(messageOf(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, attempt]);

  const reload = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  return { rows, error, loading, reload };
}
