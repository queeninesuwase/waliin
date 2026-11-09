"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/components/providers/UserProfileProvider";
import ThemeToggle from "@/components/ThemeToggle";
import EngineerBell from "@/components/notifications/EngineerBell";
import { MobileMenuButton } from "@/components/nav/MobileNav";
import { roleLabel } from "@/lib/auth";

interface HeaderUserSession {
  name: string;
  initials: string;
  role: string;
  profilePath: string;
}

export default function Header() {
  const router = useRouter();
  const { user } = useUserProfile();
  const name = user?.full_name?.trim() || user?.email || "Loading profile...";
  const sessionUser: HeaderUserSession = {
    name,
    initials: name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    role: roleLabel(user?.role ?? null) ?? "",
    profilePath: "/biomedical-engineer/profile",
  };

  return (
    <header className="w-full bg-white border-b border-gray-100 px-4 py-3 md:px-6 md:py-4 flex items-center justify-between gap-3 md:gap-4 select-none">
      <MobileMenuButton />
      <div className="flex-1 sm:hidden" />
      <div className="hidden sm:block flex-1 min-w-0 max-w-xl relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search across assets, users & requests"
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B48119] focus:bg-white transition-all"
        />
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {user?.user_id && <EngineerBell userId={user.user_id} />}
        <ThemeToggle />

        <div
          onClick={() => router.push(sessionUser.profilePath)}
          className="flex items-center gap-2 pl-2 border-l border-gray-100 cursor-pointer hover:opacity-80 transition-opacity group"
        >
          <div className="w-8 h-8 rounded-full bg-[#510423] text-white flex items-center justify-center text-sm font-semibold shadow-xs">
            {sessionUser.initials}
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-semibold text-gray-900 leading-tight group-hover:text-[#c59124] transition-colors">
              {sessionUser.name}
            </span>
            <span className="text-[10px] text-gray-400">
              {sessionUser.role}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
