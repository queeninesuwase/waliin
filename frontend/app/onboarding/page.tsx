import type { Metadata } from "next";
import Onboarding from "@/components/onboarding/Onboarding";

export const metadata: Metadata = {
  title: "Welcome | Waliin",
};

export default function OnboardingPage() {
  return <Onboarding />;
}
