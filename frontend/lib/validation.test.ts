import { describe, expect, it } from "vitest";

import {
  checkConfirmPassword,
  checkEmail,
  checkFullName,
  checkNewPassword,
  checkPassword,
} from "./validation";

describe("checkEmail", () => {
  it("accepts a normal email", () => {
    expect(checkEmail(" tigist@hospital.et ")).toBe(true);
  });

  it("asks for an email when empty", () => {
    expect(checkEmail("")).toBe("Enter your email address.");
  });

  it("refuses text that is not an email", () => {
    for (const value of ["tigist", "tigist@", "@hospital.et", "ti gist@h.et"]) {
      expect(checkEmail(value)).toBe(
        "Enter a valid email address, like name@hospital.et.",
      );
    }
  });
});

describe("checkPassword", () => {
  it("asks for the password when empty", () => {
    expect(checkPassword("")).toBe("Enter your password.");
    expect(checkPassword("anything")).toBe(true);
  });
});

describe("checkNewPassword", () => {
  it("needs at least 12 characters", () => {
    expect(checkNewPassword("")).toBe("Enter a new password.");
    expect(checkNewPassword("short")).toBe("Use at least 12 characters.");
    expect(checkNewPassword("maternity ward monitor")).toBe(true);
  });
});

describe("checkConfirmPassword", () => {
  it("must match the new password", () => {
    expect(checkConfirmPassword("", "maternity ward")).toBe(
      "Enter the password again.",
    );
    expect(checkConfirmPassword("other", "maternity ward")).toBe(
      "The passwords do not match.",
    );
    expect(checkConfirmPassword("maternity ward", "maternity ward")).toBe(true);
  });
});

describe("checkFullName", () => {
  it("needs a name", () => {
    expect(checkFullName("  ")).toBe("Enter your full name.");
    expect(checkFullName("x".repeat(121))).toBe("Use at most 120 characters.");
    expect(checkFullName(" Tigist Bekele ")).toBe(true);
  });
});
