import { Suspense } from "react";

import UsersPage from "@/features/users/pages/UsersPage";

export default function Page() {
  return (
    <Suspense>
      <UsersPage />
    </Suspense>
  );
}
