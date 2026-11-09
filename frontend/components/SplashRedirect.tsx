"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasSeenOnboarding } from "@/lib/onboarding";

const SPLASH_DURATION_MS = 2000;

export default function SplashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(hasSeenOnboarding() ? "/get-started" : "/onboarding");
    }, SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
}
