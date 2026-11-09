import Link from "next/link";

import { MenuIcon, SearchIcon } from "@/components/layout/navIcons";
import NotificationBell from "@/components/layout/NotificationBell";
import ThemeToggle from "@/components/layout/ThemeToggle";
import Avatar from "@/components/ui/Avatar";
import type { SignInStatus } from "@/features/auth/api";
import { displayName, roleLabel } from "@/lib/user";

type TopBarProps = {
  user: SignInStatus;
  onOpenMenu: () => void;
};

export default function TopBar({ user, onOpenMenu }: TopBarProps) {
  return (
    <header className="flex h-20 items-center gap-4 border-b border-gray-200 bg-white px-4 md:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-brand hover:bg-gray-100 md:hidden"
      >
        <MenuIcon className="h-6 w-6" />
      </button>
      <label className="relative hidden max-w-md flex-1 sm:block">
        <span className="sr-only">Search</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search across assets, users & requests"
          className="h-11 w-full rounded-lg bg-gray-100 pr-3 pl-10 text-base text-foreground placeholder:text-gray-400 focus:ring-2 focus:ring-rose focus:outline-none"
        />
      </label>

      <div className="ml-auto flex items-center gap-4">
        <NotificationBell userId={user.user_id} />

        <ThemeToggle />

        <Link
          href="/profile"
          aria-label="My profile"
          className="flex items-center gap-3 rounded-lg hover:opacity-90"
        >
          <Avatar
            userId={user.user_id}
            fullName={user.full_name}
            email={user.email}
          />
          <div className="hidden leading-tight sm:block">
            <p className="text-base font-semibold text-foreground">
              {displayName(user.full_name, user.email)}
            </p>
            <p className="text-sm text-gray-500">{roleLabel(user.role)}</p>
          </div>
        </Link>
      </div>
    </header>
  );
}
