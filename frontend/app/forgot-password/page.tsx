import type { Metadata } from "next";

import ForgotPasswordForm from "@/components/login/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password | Waliin",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
