"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { hasSeenOnboarding } from "@/features/onboarding/storage";

const SPLASH_DURATION_MS = 2000;

// After the splash: onboarding the first time, get started after that.
export default function SplashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(hasSeenOnboarding() ? "/welcome" : "/onboarding");
    }, SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
}
