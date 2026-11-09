import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch, isSignedOutError } from "./client";

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(body === null ? null : JSON.stringify(body), { status }),
    );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("calls the /api proxy and returns the JSON", async () => {
    const fetchMock = mockFetch(200, { status: "ok" });

    expect(await apiFetch("/health")).toEqual({ status: "ok" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/health");
  });

  it("returns nothing for 204 No Content", async () => {
    mockFetch(204, null);

    expect(await apiFetch("/auth/logout", { method: "POST" })).toBeUndefined();
  });

  it("uses the backend message when there is one", async () => {
    mockFetch(401, { detail: "Invalid email or password." });

    const error = (await apiFetch("/auth/login").catch(
      (err: unknown) => err,
    )) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(error.message).toBe("Invalid email or password.");
  });

  it("uses a general message for validation errors", async () => {
    mockFetch(422, { detail: [{ msg: "field required" }] });

    await expect(apiFetch("/auth/login")).rejects.toThrow(
      "Something went wrong. Please try again.",
    );
  });

  it("explains when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await expect(apiFetch("/auth/login")).rejects.toThrow(
      "Cannot reach the server. Check your connection.",
    );
  });
});

describe("isSignedOutError", () => {
  it("is true for 401 and 403 only", () => {
    expect(isSignedOutError(new ApiError(401, "Not signed in."))).toBe(true);
    expect(isSignedOutError(new ApiError(403, "No access."))).toBe(true);
    expect(isSignedOutError(new ApiError(500, "Server error."))).toBe(false);
    expect(isSignedOutError(new ApiError(0, "Cannot reach the server."))).toBe(
      false,
    );
    expect(isSignedOutError(new Error("other"))).toBe(false);
  });
});
