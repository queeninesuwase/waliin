import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./api/client";
import {
  acceptErrorMessage,
  acceptInvitation,
  forgotErrorMessage,
  isExpiredResetLink,
  login,
  loginErrorMessage,
  pathAfterAccept,
  pathAfterLogin,
  requestPasswordReset,
  resetErrorMessage,
  resetPassword,
  roleLabel,
  type SignInStatus,
} from "./auth";

const NURSE: SignInStatus = {
  user_id: "1",
  full_name: "Tigist Bekele",
  email: "tigist@hospital.et",
  role: "clinical_staff",
  department_id: "2",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("login", () => {
  it("signs in to the PWA", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(NURSE)));

    vi.stubGlobal("fetch", fetchMock);

    await login("tigist@hospital.et", "maternity ward monitor");

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      email: "tigist@hospital.et",
      password: "maternity ward monitor",
    });
  });
});

describe("pathAfterLogin", () => {
  it("sends clinical staff home when no code is needed", () => {
    expect(pathAfterLogin(NURSE)).toBe("/home");
    expect(pathAfterLogin({ ...NURSE, next_step: "done" })).toBe("/home");
  });

  it("sends biomedical engineers to their dashboard when no code is needed", () => {
    const engineer: SignInStatus = {
      ...NURSE,
      role: "biomedical_engineer",
    };

    expect(pathAfterLogin(engineer)).toBe("/biomedical-engineer/dashboard");

    expect(pathAfterLogin({ ...engineer, next_step: "done" })).toBe(
      "/biomedical-engineer/dashboard",
    );
  });

  it("sends engineers to the correct MFA step", () => {
    const engineer: SignInStatus = {
      ...NURSE,
      role: "biomedical_engineer",
    };

    expect(pathAfterLogin({ ...engineer, next_step: "mfa_verify" })).toBe(
      "/login/verify",
    );

    expect(pathAfterLogin({ ...engineer, next_step: "mfa_setup" })).toBe(
      "/login/setup-mfa",
    );
  });
});

describe("roleLabel", () => {
  it("shows the chosen role", () => {
    expect(roleLabel("clinical_staff")).toBe("Clinical staff");
    expect(roleLabel("biomedical_engineer")).toBe("Biomedical engineer");
  });

  it("ignores anything else", () => {
    expect(roleLabel(null)).toBeNull();
    expect(roleLabel("health_manager")).toBeNull();
  });
});

describe("loginErrorMessage", () => {
  it("picks the message from the HTTP status", () => {
    expect(loginErrorMessage(new ApiError(401, "anything"))).toBe(
      "Email or password is not correct.",
    );

    expect(loginErrorMessage(new ApiError(403, "anything"))).toBe(
      "This app is for clinical staff and engineers. Health managers use the Waliin dashboard.",
    );

    expect(loginErrorMessage(new ApiError(429, "anything"))).toBe(
      "Too many attempts. Wait a few minutes and try again.",
    );

    expect(loginErrorMessage(new ApiError(0, "anything"))).toBe(
      "Cannot reach the server. Check your connection.",
    );
  });

  it("falls back to a general message", () => {
    expect(loginErrorMessage(new ApiError(500, "anything"))).toBe(
      "Could not sign in. Try again.",
    );

    expect(loginErrorMessage(new Error("boom"))).toBe(
      "Could not sign in. Try again.",
    );
  });
});

describe("password reset calls", () => {
  it("asks for a reset link", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ message: "ok" })));

    vi.stubGlobal("fetch", fetchMock);

    await requestPasswordReset("tigist@hospital.et");

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe("/api/auth/forgot-password");
    expect(JSON.parse(init.body)).toEqual({
      email: "tigist@hospital.et",
    });
  });

  it("sends the token and both passwords", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ message: "ok" })));

    vi.stubGlobal("fetch", fetchMock);

    await resetPassword(
      "token-from-link",
      "new password 12",
      "new password 12",
    );

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe("/api/auth/reset-password");
    expect(JSON.parse(init.body)).toEqual({
      token: "token-from-link",
      password: "new password 12",
      confirm_password: "new password 12",
    });
  });
});

describe("password reset messages", () => {
  it("picks the forgot password message from the HTTP status", () => {
    expect(forgotErrorMessage(new ApiError(429, "anything"))).toBe(
      "Too many requests. Wait 15 minutes and try again.",
    );

    expect(forgotErrorMessage(new ApiError(0, "anything"))).toBe(
      "Cannot reach the server. Check your connection.",
    );

    expect(forgotErrorMessage(new ApiError(500, "anything"))).toBe(
      "Could not send the link. Try again.",
    );
  });

  it("picks the reset message from the HTTP status", () => {
    expect(resetErrorMessage(new ApiError(400, "anything"))).toBe(
      "This reset link is invalid or has expired.",
    );

    expect(resetErrorMessage(new ApiError(422, "anything"))).toBe(
      "Choose a stronger password with at least 12 characters.",
    );

    expect(resetErrorMessage(new Error("boom"))).toBe(
      "Could not change the password. Try again.",
    );
  });

  it("knows when the link has expired", () => {
    expect(isExpiredResetLink(new ApiError(400, "anything"))).toBe(true);
    expect(isExpiredResetLink(new ApiError(422, "anything"))).toBe(false);
  });
});

describe("accept invitation", () => {
  it("sends the token, name and both passwords", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "ok", role: "clinical_staff" })),
      );

    vi.stubGlobal("fetch", fetchMock);

    const reply = await acceptInvitation(
      "token-from-link",
      "Tigist Bekele",
      "new password 12",
      "new password 12",
    );

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe("/api/auth/accept-invite");
    expect(JSON.parse(init.body)).toEqual({
      token: "token-from-link",
      full_name: "Tigist Bekele",
      password: "new password 12",
      confirm_password: "new password 12",
    });

    expect(reply.role).toBe("clinical_staff");
  });

  it("goes to sign in for the role", () => {
    expect(pathAfterAccept("clinical_staff")).toBe(
      "/login?as=clinical_staff&welcome=1",
    );

    expect(pathAfterAccept("biomedical_engineer")).toBe(
      "/login?as=biomedical_engineer&welcome=1",
    );

    expect(pathAfterAccept(undefined)).toBe("/login?welcome=1");
    expect(pathAfterAccept("health_manager")).toBe("/login?welcome=1");
  });

  it("picks the message from the HTTP status", () => {
    expect(acceptErrorMessage(new ApiError(400, "anything"))).toBe(
      "This invitation link is invalid or has expired. Ask your health manager for a new one.",
    );

    expect(acceptErrorMessage(new ApiError(422, "anything"))).toBe(
      "Choose a stronger password with at least 12 characters.",
    );

    expect(acceptErrorMessage(new Error("boom"))).toBe(
      "Could not create your account. Try again.",
    );
  });
});
