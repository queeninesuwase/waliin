import { describe, expect, it } from "vitest";

import { checkDepartment, checkInviteEmail, checkRole } from "./validation";

describe("invite form checks", () => {
  it("needs a valid email", () => {
    expect(checkInviteEmail("")).toBe("Enter the user's email address.");
    expect(checkInviteEmail("hana")).toBe(
      "Enter a valid email address, like name@hospital.et.",
    );
    expect(checkInviteEmail(" hana@hospital.et ")).toBe(true);
  });

  it("needs a user type", () => {
    expect(checkRole("")).toBe("Choose a user type.");
    expect(checkRole("health_manager")).toBe("Choose a user type.");
    expect(checkRole("clinical_staff")).toBe(true);
  });

  it("needs a department", () => {
    expect(checkDepartment("")).toBe("Choose a department.");
    expect(checkDepartment("d1")).toBe(true);
  });
});
