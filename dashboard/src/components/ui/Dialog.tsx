"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

type DialogProps = {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  closeButton?: boolean;
};

export default function Dialog({
  title,
  description,
  onClose,
  children,
  closeButton = false,
}: DialogProps) {
  return (
    <RadixDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <RadixDialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-white p-6 shadow-xl focus:outline-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-2xl font-bold text-brand">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-base text-gray-500">
                  {description}
                </RadixDialog.Description>
              )}
            </div>

            {closeButton && (
              <RadixDialog.Close asChild>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </RadixDialog.Close>
            )}
          </div>

          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
