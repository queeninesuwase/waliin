"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import ProfileAvatar from "@/components/profile/ProfileAvatar";

export type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  active: boolean;
};

export type SidebarUser = {
  userId: string | null;
  name: string;
  email: string;
  role: string;
};

type WaliinSidebarProps = {
  homeHref: string;
  items: NavItem[];
  user: SidebarUser;
  profileHref: string;
  profileActive: boolean;
  onSignOut: () => Promise<void>;
};

function linkClass(active: boolean) {
  return active
    ? "flex items-center gap-4 rounded-lg bg-[#d9a00a] px-4 py-3 text-base font-semibold text-white"
    : "flex items-center gap-4 rounded-lg px-4 py-3 text-base font-medium text-white/85 hover:bg-white/10 hover:text-white";
}

export default function WaliinSidebar({
  homeHref,
  items,
  user,
  profileHref,
  profileActive,
  onSignOut,
}: WaliinSidebarProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await onSignOut();
  }

  return (
    <nav
      aria-label="Main menu"
      className="flex h-full w-full flex-col overflow-hidden bg-[#650d2f] px-5 py-8 text-white"
    >
      <Link href={homeHref} className="mb-10 flex shrink-0 justify-center">
        <Image
          src="/images/waliin-logo.png"
          alt="Waliin"
          width={1024}
          height={1024}
          priority
          className="h-auto w-32"
        />
      </Link>

      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={linkClass(item.active)}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-6 [&>svg]:w-6">
                {item.icon}
              </span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex shrink-0 flex-col gap-2 border-t border-white/15 pt-4">
        <Link
          href={profileHref}
          aria-current={profileActive ? "page" : undefined}
          className={linkClass(profileActive)}
        >
          {user.userId ? (
            <ProfileAvatar
              userId={user.userId}
              fullName={user.name}
              email={user.email}
              className="h-9 w-9 text-sm ring-2 ring-white/40"
            />
          ) : (
            <span className="h-9 w-9 shrink-0 rounded-full bg-white/20" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold">
              {user.name}
            </span>
            <span className="block truncate text-sm font-normal text-white/70">
              {user.role}
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex items-center gap-4 rounded-lg px-4 py-3 text-left text-base font-medium text-white/85 hover:bg-white/10 hover:text-white disabled:opacity-60"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </nav>
  );
}
