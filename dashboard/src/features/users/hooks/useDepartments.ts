"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  listDepartments,
  sortDepartments,
  type Department,
} from "@/features/departments/api";
import { isSignedOutError } from "@/lib/api/client";

import { departmentsLoadErrorMessage } from "../userHelpers";

export function useDepartments() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    listDepartments()
      .then((rows) => {
        if (active) setDepartments(sortDepartments(rows));
      })
      .catch((err) => {
        if (!active) return;
        if (isSignedOutError(err)) {
          router.replace("/login");
          return;
        }
        setError(departmentsLoadErrorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [router, attempt]);

  const retry = useCallback(() => {
    setError("");
    setDepartments(null);
    setAttempt((count) => count + 1);
  }, []);

  const addDepartment = useCallback((department: Department) => {
    setDepartments((rows) => sortDepartments([...(rows ?? []), department]));
  }, []);

  return { departments, error, retry, addDepartment };
}
