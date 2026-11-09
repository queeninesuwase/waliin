import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getMe,
  login,
  logout,
  newPasswordProblem,
  pathAfterLogin,
  requestPasswordReset,
  resetPassword,
  type SignInStatus,
} from "./api";

const MANAGER: SignInStatus = {
  user_id: "1",
  full_name: "Meron Alemu",
  email: "meron@hospital.et",
  role: "health_manager",
  department_id: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("login", () => {
  it("signs in to the dashboard app", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(MANAGER)));
    vi.stubGlobal("fetch", fetchMock);

    await login("meron@hospital.et", "maternity ward monitor");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      email: "meron@hospital.et",
      password: "maternity ward monitor",
    });
  });

  it("signs out and refuses other roles", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...MANAGER, role: "clinical_staff" })),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      login("tigist@hospital.et", "maternity ward monitor"),
    ).rejects.toThrow("This account cannot sign in to the dashboard.");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/logout");
  });

  it("shows the backend message for a wrong password", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ detail: "Invalid email or password." }),
            { status: 401 },
          ),
        ),
    );

    await expect(login("meron@hospital.et", "wrong")).rejects.toThrow(
      "Invalid email or password.",
    );
  });
});

describe("pathAfterLogin", () => {
  it("goes to the dashboard when no code is needed", () => {
    expect(pathAfterLogin(MANAGER)).toBe("/dashboard");
    expect(pathAfterLogin({ ...MANAGER, next_step: "done" })).toBe(
      "/dashboard",
    );
  });

  it("goes to the code step when MFA is needed", () => {
    expect(pathAfterLogin({ ...MANAGER, next_step: "mfa_verify" })).toBe(
      "/login/verify",
    );
    expect(pathAfterLogin({ ...MANAGER, next_step: "mfa_setup" })).toBe(
      "/login/setup-mfa",
    );
  });
});

describe("requestPasswordReset", () => {
  it("sends only the email", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "sent" }), { status: 202 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await requestPasswordReset("meron@hospital.et");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/forgot-password");
    expect(JSON.parse(init.body)).toEqual({ email: "meron@hospital.et" });
  });
});

describe("resetPassword", () => {
  it("sends the token and both passwords", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ message: "changed" })));
    vi.stubGlobal("fetch", fetchMock);

    await resetPassword("abc", "new long password 1", "new long password 1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/reset-password");
    expect(JSON.parse(init.body)).toEqual({
      token: "abc",
      password: "new long password 1",
      confirm_password: "new long password 1",
    });
  });
});

describe("newPasswordProblem", () => {
  it("asks for 12 characters", () => {
    expect(newPasswordProblem("short", "short")).toBe(
      "Use at least 12 characters.",
    );
  });

  it("asks for matching passwords", () => {
    expect(newPasswordProblem("new long password 1", "other password 12")).toBe(
      "The passwords do not match.",
    );
  });

  it("is happy with a long matching password", () => {
    expect(
      newPasswordProblem("new long password 1", "new long password 1"),
    ).toBe("");
  });
});

describe("getMe", () => {
  it("asks the backend who is signed in", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(MANAGER)));
    vi.stubGlobal("fetch", fetchMock);

    expect((await getMe()).email).toBe("meron@hospital.et");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/me");
  });
});

describe("logout", () => {
  it("ends the session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/logout");
    expect(init.method).toBe("POST");
  });
});
