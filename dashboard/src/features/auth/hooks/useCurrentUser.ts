"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getMe, pathAfterLogin, type SignInStatus } from "@/features/auth/api";
import { ApiError, isSignedOutError } from "@/lib/api/client";

export function useCurrentUser() {
  const router = useRouter();
  const [user, setUser] = useState<SignInStatus | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    getMe()
      .then((me) => {
        if (!active) return;
        if (me.role !== "health_manager") {
          router.replace("/login");
          return;
        }
        if (me.next_step && me.next_step !== "done") {
          router.replace(pathAfterLogin(me));
          return;
        }
        setUser(me);
      })
      .catch((err) => {
        if (!active) return;
        if (isSignedOutError(err)) {
          router.replace("/login");
          return;
        }
        setError(
          err instanceof ApiError && err.status === 0
            ? "Cannot reach the server. Check your connection."
            : "Could not load your account. Try again.",
        );
      });

    return () => {
      active = false;
    };
  }, [router, attempt]);

  const retry = useCallback(() => {
    setError("");
    setAttempt((count) => count + 1);
  }, []);

  return { user, error, retry };
}
