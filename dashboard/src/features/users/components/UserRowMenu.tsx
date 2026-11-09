"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import type { ManagedUser } from "../api";
import { isPending } from "../userHelpers";

type UserRowMenuProps = {
  user: ManagedUser;
  busy: boolean;
  onResend: () => void;
  onSendReset: () => void;
  onRevoke: () => void;
};

export default function UserRowMenu({
  user,
  busy,
  onResend,
  onSendReset,
  onRevoke,
}: UserRowMenuProps) {
  const items = [
    isPending(user.status) && {
      label: "Resend invitation",
      action: onResend,
      danger: false,
    },
    user.status === "active" && {
      label: "Send password reset link",
      action: onSendReset,
      danger: false,
    },
    user.status !== "revoked" && {
      label: "Revoke access",
      action: onRevoke,
      danger: true,
    },
  ].filter(Boolean) as { label: string; action: () => void; danger: boolean }[];

  if (!items.length) return null;

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild disabled={busy}>
        <button
          type="button"
          aria-label={`More actions for ${user.full_name || user.email}`}
          className="flex h-10 w-10 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ⋯
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              onSelect={item.action}
              className={`cursor-pointer px-4 py-3 text-base outline-none data-[highlighted]:bg-cream ${
                item.danger ? "text-red-700" : "text-foreground"
              }`}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
