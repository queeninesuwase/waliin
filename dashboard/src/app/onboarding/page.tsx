import type { Metadata } from "next";

import OnboardingPage from "@/features/onboarding/pages/OnboardingPage";

export const metadata: Metadata = {
  title: "Welcome | Waliin",
};

export default function Page() {
  return <OnboardingPage />;
}
