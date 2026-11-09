"use client";

import type { ManagedUser } from "../api";
import Dialog from "@/components/ui/Dialog";

type RevokeDialogProps = {
  user: ManagedUser;
  saving: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
};

export default function RevokeDialog({
  user,
  saving,
  error,
  onConfirm,
  onClose,
}: RevokeDialogProps) {
  return (
    <Dialog title="Revoke access" onClose={onClose}>
      <p className="text-base text-gray-600">
        Revoke access for{" "}
        <span className="font-semibold text-foreground">
          {user.full_name || user.email}
        </span>
        ? They will be signed out and can no longer use Waliin.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-brand">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-lg border border-rose px-5 text-sm font-semibold text-brand hover:bg-cream"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className="h-11 rounded-lg bg-red-700 px-5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
        >
          {saving ? "Revoking..." : "Revoke"}
        </button>
      </div>
    </Dialog>
  );
}
