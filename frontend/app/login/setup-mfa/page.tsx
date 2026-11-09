import type { Metadata } from "next";

import MfaSetupForm from "@/components/login/MfaSetupForm";

export const metadata: Metadata = {
  title: "Set up authenticator | Waliin",
};

export default function SetupMfaPage() {
  return <MfaSetupForm />;
}
