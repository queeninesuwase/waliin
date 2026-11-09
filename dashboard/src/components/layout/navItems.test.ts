import { describe, expect, it } from "vitest";

import { isActive, NAV_ITEMS } from "./navItems";

describe("isActive", () => {
  it("marks the page and its sub-pages", () => {
    expect(isActive("/users", "/users")).toBe(true);
    expect(isActive("/users/invite", "/users")).toBe(true);
  });

  it("does not mark other pages", () => {
    expect(isActive("/dashboard", "/users")).toBe(false);
    expect(isActive("/usersettings", "/users")).toBe(false);
  });
});

describe("NAV_ITEMS", () => {
  it("has the four menu pages in order", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "Dashboard",
      "Users",
      "Equipment",
      "Requests",
    ]);
  });
});
