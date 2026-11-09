"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { engineerRedirect } from "@/lib/engineerAccess";

import { useUserProfile } from "./UserProfileProvider";

export default function EngineerGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useUserProfile();
  const router = useRouter();
  const target = loading ? null : engineerRedirect(user?.role, user?.next_step);

  useEffect(() => {
    if (target) router.replace(target);
  }, [router, target]);

  if (loading || target) {
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center bg-[#F8F6F3] text-sm text-gray-500"
      >
        Loading...
      </div>
    );
  }

  return children;
}
