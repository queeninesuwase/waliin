import { describe, expect, it } from "vitest";

import { loginPathFor, ROLE_OPTIONS } from "./roles";

describe("ROLE_OPTIONS", () => {
  it("offers clinical staff and engineers, not the manager", () => {
    expect(ROLE_OPTIONS.map((option) => option.role)).toEqual([
      "clinical_staff",
      "biomedical_engineer",
    ]);
  });
});

describe("loginPathFor", () => {
  it("passes the chosen role to the sign-in page", () => {
    expect(loginPathFor("clinical_staff")).toBe("/login?as=clinical_staff");
    expect(loginPathFor("biomedical_engineer")).toBe(
      "/login?as=biomedical_engineer",
    );
  });
});
