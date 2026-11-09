import { afterEach, describe, expect, it, vi } from "vitest";

import { hasSeenOnboarding, markOnboardingSeen } from "./storage";

function fakeStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("onboarding storage", () => {
  it("is not seen at first, then remembered", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });

    expect(hasSeenOnboarding()).toBe(false);
    markOnboardingSeen();
    expect(hasSeenOnboarding()).toBe(true);
  });

  it("does not crash when storage is blocked", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });

    expect(hasSeenOnboarding()).toBe(false);
    expect(() => markOnboardingSeen()).not.toThrow();
  });
});
