import type { Metadata } from "next";
import { Suspense } from "react";

import LoginForm from "@/components/login/LoginForm";

export const metadata: Metadata = {
  title: "Sign in | Waliin",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
