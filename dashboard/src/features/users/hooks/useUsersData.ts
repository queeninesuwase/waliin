"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { isSignedOutError } from "@/lib/api/client";

import { listUsers, type ManagedUser, type UserFilters } from "../api";
import { loadErrorMessage, managedOnly } from "../userHelpers";

export function useUsersData({ role, department_id }: UserFilters) {
  const router = useRouter();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    listUsers({ role, department_id })
      .then((rows) => {
        if (!active) return;
        setUsers(managedOnly(rows));
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        if (isSignedOutError(err)) {
          router.replace("/login");
          return;
        }
        setError(loadErrorMessage(err));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router, attempt, role, department_id]);

  const retry = useCallback(() => {
    setError("");
    setLoading(true);
    setAttempt((count) => count + 1);
  }, []);

  const replaceUser = useCallback((updated: ManagedUser) => {
    setUsers((rows) =>
      rows
        ? rows.map((row) => (row.user_id === updated.user_id ? updated : row))
        : rows,
    );
  }, []);

  return { users, loading, error, retry, replaceUser };
}
