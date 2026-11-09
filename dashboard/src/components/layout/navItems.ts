import {
  ClipboardIcon,
  DashboardIcon,
  UsersIcon,
  WrenchIcon,
} from "@/components/layout/navIcons";

export type NavItem = {
  label: string;
  href: string;
  Icon: (props: { className?: string }) => React.ReactNode;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", Icon: DashboardIcon },
  { label: "Users", href: "/users", Icon: UsersIcon },
  { label: "Equipment", href: "/equipment", Icon: WrenchIcon },
  { label: "Requests", href: "/requests", Icon: ClipboardIcon },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
