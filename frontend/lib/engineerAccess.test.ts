import { describe, expect, it } from "vitest";

import {
  clinicalRedirect,
  engineerRedirect,
  mfaRedirect,
} from "./engineerAccess";

describe("mfaRedirect", () => {
  it("sends unfinished sign-ins to the authenticator steps", () => {
    expect(mfaRedirect("mfa_setup")).toBe("/login/setup-mfa");
    expect(mfaRedirect("mfa_verify")).toBe("/login/verify");
    expect(mfaRedirect("done")).toBeNull();
    expect(mfaRedirect(undefined)).toBeNull();
  });
});

describe("engineerRedirect", () => {
  it("lets engineers stay once the code is checked", () => {
    expect(engineerRedirect("biomedical_engineer")).toBeNull();
    expect(engineerRedirect("biomedical_engineer", "done")).toBeNull();
  });

  it("asks engineers for the authenticator code first", () => {
    expect(engineerRedirect("biomedical_engineer", "mfa_verify")).toBe(
      "/login/verify",
    );
  });

  it("sends clinical staff to their home page", () => {
    expect(engineerRedirect("clinical_staff")).toBe("/home");
  });

  it("sends everyone else to the engineer sign in", () => {
    expect(engineerRedirect(null)).toBe("/login?as=biomedical_engineer");
    expect(engineerRedirect("health_manager")).toBe(
      "/login?as=biomedical_engineer",
    );
  });
});

describe("clinicalRedirect", () => {
  it("lets clinical staff stay once the code is checked", () => {
    expect(clinicalRedirect("clinical_staff")).toBeNull();
    expect(clinicalRedirect("clinical_staff", "done")).toBeNull();
  });

  it("asks clinical staff to set up or enter the authenticator code", () => {
    expect(clinicalRedirect("clinical_staff", "mfa_setup")).toBe(
      "/login/setup-mfa",
    );
    expect(clinicalRedirect("clinical_staff", "mfa_verify")).toBe(
      "/login/verify",
    );
  });

  it("sends engineers to their dashboard", () => {
    expect(clinicalRedirect("biomedical_engineer")).toBe(
      "/biomedical-engineer/dashboard",
    );
  });

  it("sends signed-out people to the clinical sign in", () => {
    expect(clinicalRedirect(null)).toBe("/login?as=clinical_staff");
  });

  it("sends anyone else back to the start", () => {
    expect(clinicalRedirect("health_manager")).toBe("/continue-as");
  });
});
