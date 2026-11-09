"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useUserProfile } from "@/components/providers/UserProfileProvider";
import ProfileView from "@/components/profile/ProfileView";
import { signOut } from "@/lib/session";

export default function EngineerProfilePage() {
  const router = useRouter();
  const { user, loading } = useUserProfile();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?as=biomedical_engineer");
  }, [loading, user, router]);

  if (!user) {
    return (
      <p role="status" className="py-10 text-center text-sm text-gray-500">
        Loading...
      </p>
    );
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <ProfileView
        user={user}
        onSignOut={async () => {
          await signOut();
          router.replace("/continue-as");
        }}
      />
    </div>
  );
}
