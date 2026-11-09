import type { ComponentProps } from "react";

type RoleCardProps = Omit<ComponentProps<"input">, "type"> & {
  label: string;
  description: string;
  checked: boolean;
};

export default function RoleCard({
  label,
  description,
  checked,
  ...inputProps
}: RoleCardProps) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-4 rounded-lg border p-6 ${
        checked
          ? "border-brand bg-cream ring-1 ring-brand"
          : "border-rose bg-white"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        className="mt-1.5 h-5 w-5 accent-brand"
        {...inputProps}
      />
      <span>
        <span className="block text-lg font-semibold text-foreground">
          {label}
        </span>
        <span className="block text-base text-gray-500">{description}</span>
      </span>
    </label>
  );
}
