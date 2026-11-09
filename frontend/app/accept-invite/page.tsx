import type { Metadata } from "next";
import { Suspense } from "react";

import CreateAccountForm from "@/components/login/CreateAccountForm";

export const metadata: Metadata = {
  title: "Create your account | Waliin",
};

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <CreateAccountForm />
    </Suspense>
  );
}
