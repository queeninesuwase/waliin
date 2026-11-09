import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./api/client";
import {
  confirmMfa,
  formatSecret,
  mfaErrorMessage,
  setupMfa,
  verifyMfa,
} from "./auth";
import { checkCode } from "./validation";

function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MFA calls", () => {
  it("starts the setup", async () => {
    const fetchMock = mockFetch({ secret: "ABC", otpauth_uri: "otpauth://x" });
    expect((await setupMfa()).otpauth_uri).toBe("otpauth://x");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/mfa/setup");
    expect(init.method).toBe("POST");
  });

  it("confirms the first code", async () => {
    const fetchMock = mockFetch({ next_step: "done" });
    expect((await confirmMfa("123456")).next_step).toBe("done");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/mfa/confirm");
    expect(JSON.parse(init.body)).toEqual({ code: "123456" });
  });

  it("verifies a code at sign-in", async () => {
    const fetchMock = mockFetch({ next_step: "done" });
    await verifyMfa("654321");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/mfa/verify");
    expect(JSON.parse(init.body)).toEqual({ code: "654321" });
  });
});

describe("mfaErrorMessage", () => {
  it("explains a wrong code", () => {
    expect(mfaErrorMessage(new ApiError(400, "x"))).toBe(
      "The code is not correct. Try the newest code in your app.",
    );
  });

  it("explains a lost connection", () => {
    expect(mfaErrorMessage(new ApiError(0, "x"))).toBe(
      "Cannot reach the server. Check your connection.",
    );
  });

  it("falls back for anything else", () => {
    expect(mfaErrorMessage("boom")).toBe(
      "Could not check the code. Try again.",
    );
  });
});

describe("helpers", () => {
  it("groups the setup key by 4", () => {
    expect(formatSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
  });

  it("checks the 6-digit code", () => {
    expect(checkCode("")).toBe("Enter the 6-digit code.");
    expect(checkCode("12345")).toBe("The code has 6 digits.");
    expect(checkCode("12a456")).toBe("The code has 6 digits.");
    expect(checkCode(" 123456 ")).toBe(true);
  });
});
