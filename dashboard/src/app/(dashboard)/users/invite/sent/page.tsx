import { Suspense } from "react";

import InvitationSentPage from "@/features/users/pages/InvitationSentPage";

export default function Page() {
  return (
    <Suspense>
      <InvitationSentPage />
    </Suspense>
  );
}
