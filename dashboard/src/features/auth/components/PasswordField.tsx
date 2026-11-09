"use client";

import { useState, type ComponentProps } from "react";

import AuthField from "@/features/auth/components/AuthField";
import { EyeIcon, EyeOffIcon } from "@/features/auth/components/icons";

type PasswordFieldProps = Omit<ComponentProps<"input">, "type"> & {
  id: string;
  label: string;
  error?: string;
};

export default function PasswordField({
  id,
  label,
  error,
  ...inputProps
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <AuthField
      id={id}
      label={label}
      error={error}
      type={visible ? "text" : "password"}
      {...inputProps}
      trailing={
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-brand"
        >
          {visible ? (
            <EyeOffIcon className="h-5 w-5" />
          ) : (
            <EyeIcon className="h-5 w-5" />
          )}
        </button>
      }
    />
  );
}
