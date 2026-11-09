"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CloseIcon } from "@/components/layout/navIcons";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { logout } from "@/features/auth/api";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { ApiError } from "@/lib/api/client";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, error, retry } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    setSignOutError("");
    setSigningOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch (err) {
      setSignOutError(
        err instanceof ApiError && err.status === 0
          ? "Could not sign out. Check your connection and try again."
          : "Could not sign out. Try again.",
      );
      setSigningOut(false);
    }
  }

  if (!user && error) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-background px-6">
        <div
          role="alert"
          className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-rose bg-white p-8 text-center"
        >
          <p className="text-lg font-semibold text-brand">
            Could not load the dashboard
          </p>
          <p className="text-base text-gray-500">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="h-12 w-full rounded-lg bg-brand text-base font-semibold text-white hover:bg-brand-dark"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        role="status"
        className="flex min-h-screen flex-1 items-center justify-center bg-background text-sm text-gray-500"
      >
        Loading...
      </div>
    );
  }

  const sidebarProps = { user, onSignOut: handleSignOut, signingOut };

  return (
    <div className="flex min-h-screen flex-1 bg-background">
      <aside className="sticky top-0 hidden h-screen shrink-0 md:block">
        <Sidebar {...sidebarProps} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative h-full w-72">
            <Sidebar {...sidebarProps} onNavigate={() => setMenuOpen(false)} />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="absolute top-4 right-3 flex h-9 w-9 items-center justify-center text-white"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} onOpenMenu={() => setMenuOpen(true)} />
        {signOutError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 border-b border-rose bg-rose/20 px-4 py-3 text-base text-brand md:px-8"
          >
            <span>{signOutError}</span>
            <button
              type="button"
              onClick={() => setSignOutError("")}
              className="font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
