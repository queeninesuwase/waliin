"use client";

import { Moon, Sun } from "lucide-react";

import { saveTheme } from "@/lib/theme";
import { useIsDark } from "@/lib/useTheme";

export default function ThemeToggle() {
  const dark = useIsDark();

  return (
    <button
      type="button"
      onClick={() => saveTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-[#650d2f] hover:bg-gray-100"
    >
      {dark ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
