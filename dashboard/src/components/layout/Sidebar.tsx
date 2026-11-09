"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutIcon } from "@/components/layout/navIcons";
import { isActive, NAV_ITEMS } from "@/components/layout/navItems";
import Avatar from "@/components/ui/Avatar";
import type { SignInStatus } from "@/features/auth/api";
import { displayName, roleLabel } from "@/lib/user";

type SidebarProps = {
  user: SignInStatus;
  onSignOut: () => void;
  signingOut?: boolean;
  onNavigate?: () => void;
};

function linkClass(active: boolean) {
  return active
    ? "flex items-center gap-4 rounded-lg bg-gold px-4 py-3.5 text-lg font-semibold text-white"
    : "flex items-center gap-4 rounded-lg px-4 py-3.5 text-lg font-medium text-white/85 hover:bg-white/10 hover:text-white";
}

export default function Sidebar({
  user,
  onSignOut,
  signingOut = false,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main menu"
      className="flex h-full w-72 flex-col bg-brand px-5 py-8 text-white"
    >
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="mb-10 flex justify-center"
      >
        <Image
          src="/images/waliin-logo.png"
          alt="Waliin"
          width={1024}
          height={1024}
          priority
          className="h-auto w-32"
        />
      </Link>

      <ul className="flex flex-col gap-4">
        {NAV_ITEMS.map(({ label, href, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={linkClass(active)}
              >
                <Icon className="h-7 w-7" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-2 border-t border-white/15 pt-4">
        <Link
          href="/profile"
          onClick={onNavigate}
          aria-current={isActive(pathname, "/profile") ? "page" : undefined}
          className={linkClass(isActive(pathname, "/profile"))}
        >
          <Avatar
            userId={user.user_id}
            fullName={user.full_name}
            email={user.email}
            className="h-9 w-9 text-sm ring-2 ring-white/40"
          />
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold">
              {displayName(user.full_name, user.email)}
            </span>
            <span className="block text-sm font-normal text-white/70">
              {roleLabel(user.role)}
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="flex items-center gap-4 rounded-lg px-4 py-3.5 text-left text-lg font-medium text-white/85 hover:bg-white/10 hover:text-white disabled:opacity-60"
        >
          <SignOutIcon className="h-7 w-7" />
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </nav>
  );
}
