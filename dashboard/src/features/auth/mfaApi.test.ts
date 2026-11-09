import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import {
  confirmMfaSetup,
  formatSecret,
  mfaErrorMessage,
  startMfaSetup,
  verifyMfaCode,
} from "./mfaApi";

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

    expect((await startMfaSetup()).secret).toBe("ABC");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/mfa/setup");
    expect(init.method).toBe("POST");
  });

  it("confirms with the first code", async () => {
    const fetchMock = mockFetch({ next_step: "done" });

    const result = await confirmMfaSetup("123456");

    expect(result.next_step).toBe("done");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/mfa/confirm");
    expect(JSON.parse(init.body)).toEqual({ code: "123456" });
  });

  it("verifies a code at sign-in", async () => {
    const fetchMock = mockFetch({ next_step: "done" });

    await verifyMfaCode("654321");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/mfa/verify");
    expect(JSON.parse(init.body)).toEqual({ code: "654321" });
  });

  it("shows a wrong code message from the backend", async () => {
    mockFetch({ detail: "The code is not correct." }, 400);

    await expect(verifyMfaCode("000000")).rejects.toThrow(
      "The code is not correct.",
    );
  });
});

describe("mfaErrorMessage", () => {
  it("explains a wrong code", () => {
    expect(mfaErrorMessage(new ApiError(400, "Invalid code."))).toBe(
      "The code is not correct. Try the newest code.",
    );
  });

  it("explains a lost connection", () => {
    expect(mfaErrorMessage(new ApiError(0, ""))).toBe(
      "Cannot reach the server. Check your connection.",
    );
  });

  it("falls back for unknown errors", () => {
    expect(mfaErrorMessage("boom")).toBe("Could not check the code.");
  });
});

describe("formatSecret", () => {
  it("splits the key into groups of 4", () => {
    expect(formatSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
    expect(formatSecret("ABCDEF")).toBe("ABCD EF");
  });
});
