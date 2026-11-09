import { describe, expect, it } from "vitest";

import {
  checkCode,
  checkEmail,
  checkNewPassword,
  checkPassword,
  checkSamePassword,
} from "./validation";

describe("checkEmail", () => {
  it("accepts a normal email, with spaces around it", () => {
    expect(checkEmail("meron@hospital.et")).toBe(true);
    expect(checkEmail("  meron@hospital.et ")).toBe(true);
  });

  it("asks for an email when empty", () => {
    expect(checkEmail("")).toBe("Enter your email address.");
    expect(checkEmail("   ")).toBe("Enter your email address.");
  });

  it("refuses text that is not an email", () => {
    for (const value of [
      "meron",
      "meron@",
      "@hospital.et",
      "meron@hospital",
      "me ron@hospital.et",
    ]) {
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
  it("needs 12 to 128 characters", () => {
    expect(checkNewPassword("short")).toBe("Use at least 12 characters.");
    expect(checkNewPassword("x".repeat(129))).toBe(
      "Use at most 128 characters.",
    );
    expect(checkNewPassword("new long password 1")).toBe(true);
  });
});

describe("checkSamePassword", () => {
  it("needs the same password twice", () => {
    expect(checkSamePassword("", "new long password 1")).toBe(
      "Enter the new password again.",
    );
    expect(checkSamePassword("other password 12", "new long password 1")).toBe(
      "The passwords do not match.",
    );
    expect(
      checkSamePassword("new long password 1", "new long password 1"),
    ).toBe(true);
  });
});

describe("checkCode", () => {
  it("needs exactly 6 digits", () => {
    expect(checkCode("")).toBe("Enter the 6-digit code.");
    expect(checkCode("12345")).toBe("The code has 6 digits.");
    expect(checkCode("12345a")).toBe("The code has 6 digits.");
    expect(checkCode(" 123456 ")).toBe(true);
  });
});
