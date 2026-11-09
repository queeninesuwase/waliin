import type { Metadata } from "next";
import { Suspense } from "react";

import ResetPasswordForm from "@/components/login/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password | Waliin",
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
