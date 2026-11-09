import { describe, expect, it } from "vitest";

import { displayName, initials, roleLabel } from "./user";

describe("roleLabel", () => {
  it("shows a readable role", () => {
    expect(roleLabel("health_manager")).toBe("Health Manager");
    expect(roleLabel("biomedical_engineer")).toBe("Biomedical Engineer");
  });
});

describe("initials", () => {
  it("uses the first and last name", () => {
    expect(initials("Meron Alemu", "meron@hospital.et")).toBe("MA");
    expect(initials("Dr. Kamau Otieno Odhiambo", "k@h.et")).toBe("DO");
  });

  it("uses the email when there is no name", () => {
    expect(initials(null, "meron@hospital.et")).toBe("M");
    expect(initials("  ", "meron@hospital.et")).toBe("M");
  });
});

describe("displayName", () => {
  it("falls back to the email", () => {
    expect(displayName("Meron Alemu", "m@h.et")).toBe("Meron Alemu");
    expect(displayName(null, "m@h.et")).toBe("m@h.et");
  });
});
