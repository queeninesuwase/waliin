"use client";

import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import ProfileView from "@/components/profile/ProfileView";
import { signOut } from "@/lib/session";

export default function ProfilePage() {
  const router = useRouter();

  return (
    <AppShell active="profile" title="My profile">
      {(user) => (
        <ProfileView
          user={user}
          onSignOut={async () => {
            await signOut();
            router.replace("/continue-as");
          }}
        />
      )}
    </AppShell>
  );
}
