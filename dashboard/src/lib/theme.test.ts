import { describe, expect, it } from "vitest";

import { isTheme, resolveTheme, THEME_SCRIPT } from "./theme";

describe("theme", () => {
  it("accepts only known themes", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(true);
    expect(isTheme("blue")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("follows the device for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("reads the saved theme before the page paints", () => {
    expect(THEME_SCRIPT).toContain("waliin-theme");
    expect(THEME_SCRIPT).toContain("prefers-color-scheme: dark");
  });
});
