"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import WaliinSidebar from "@/components/nav/WaliinSidebar";
import { signOut } from "@/lib/session";

type ActiveKey = "home" | "requests" | "equipment" | "profile";

type Props = {
  active: ActiveKey;
  userName: string;
  userRole: string;
  userId?: string | null;
  email?: string;
};

const icon = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ITEMS: {
  key: ActiveKey;
  label: string;
  href: string;
  icon: ReactNode;
}[] = [
  {
    key: "home",
    label: "Home",
    href: "/home",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    key: "requests",
    label: "My fault reports",
    href: "/requests",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4h6v3H9zM9 12h6M9 16h6" />
      </svg>
    ),
  },
  {
    key: "equipment",
    label: "Equipment requests",
    href: "/equipment-requests",
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <path d="M3 4h18v12H3zM8 20h8M12 16v4" />
        <path d="M12 7v6M9 10h6" />
      </svg>
    ),
  },
];

export default function Sidebar({
  active,
  userName,
  userRole,
  userId = null,
  email = "",
}: Props) {
  const router = useRouter();

  return (
    <div className="sticky top-0 h-screen">
      <WaliinSidebar
        homeHref="/home"
        items={ITEMS.map((item) => ({
          label: item.label,
          href: item.href,
          icon: item.icon,
          active: active === item.key,
        }))}
        user={{ userId, name: userName, email, role: userRole }}
        profileHref="/profile"
        profileActive={active === "profile"}
        onSignOut={async () => {
          await signOut();
          router.replace("/continue-as");
        }}
      />
    </div>
  );
}
