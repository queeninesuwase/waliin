import { describe, expect, it } from "vitest";

import { wrongRoleMessage } from "./auth";

describe("wrongRoleMessage", () => {
  it("allows the role that was chosen", () => {
    expect(
      wrongRoleMessage("biomedical_engineer", "biomedical_engineer"),
    ).toBeNull();
    expect(wrongRoleMessage("clinical_staff", "clinical_staff")).toBeNull();
  });

  it("allows sign in when no role was chosen", () => {
    expect(wrongRoleMessage(null, "clinical_staff")).toBeNull();
    expect(wrongRoleMessage("unknown", "clinical_staff")).toBeNull();
  });

  it("blocks clinical staff on the engineer sign in", () => {
    expect(wrongRoleMessage("biomedical_engineer", "clinical_staff")).toBe(
      "This is a Clinical staff account. Go back and choose Clinical staff to sign in.",
    );
  });

  it("blocks engineers on the clinical staff sign in", () => {
    expect(wrongRoleMessage("clinical_staff", "biomedical_engineer")).toBe(
      "This is a Biomedical engineer account. Go back and choose Biomedical engineer to sign in.",
    );
  });

  it("blocks other roles", () => {
    expect(wrongRoleMessage("clinical_staff", "health_manager")).toBe(
      "This account cannot sign in as Clinical staff.",
    );
  });
});
