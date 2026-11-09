import type { Metadata } from "next";

import MfaVerifyForm from "@/components/login/MfaVerifyForm";

export const metadata: Metadata = {
  title: "Enter your code | Waliin",
};

export default function VerifyMfaPage() {
  return <MfaVerifyForm />;
}
