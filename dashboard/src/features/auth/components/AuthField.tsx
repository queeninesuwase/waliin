import type { ComponentProps, ReactNode } from "react";

type AuthFieldProps = ComponentProps<"input"> & {
  id: string;
  label: string;
  trailing?: ReactNode;
  error?: string;
};

const INPUT_CLASS =
  "h-14 w-full rounded-lg border bg-white px-4 pr-12 text-base text-foreground placeholder:text-gray-400 focus:border-brand focus:outline-none";

export default function AuthField({
  id,
  label,
  trailing,
  error,
  ...inputProps
}: AuthFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="sr-only text-sm font-semibold text-foreground md:not-sr-only"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          placeholder={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${INPUT_CLASS} ${error ? "border-brand" : "border-rose"}`}
          {...inputProps}
        />
        {trailing}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-brand">
          {error}
        </p>
      )}
    </div>
  );
}
