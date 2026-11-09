import { afterEach, describe, expect, it, vi } from "vitest";

import { loadDashboard } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function serve(failing: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: string) => {
      if (failing.some((path) => url === `/api${path}`)) {
        return new Response(JSON.stringify({ detail: "boom" }), {
          status: 500,
        });
      }
      return new Response(
        JSON.stringify(url.includes("maintenance-summary") ? {} : []),
        { status: 200 },
      );
    }),
  );
}

describe("loadDashboard", () => {
  it("lists every source that failed instead of hiding it", async () => {
    serve(["/requests", "/equipment/pending"]);

    const data = await loadDashboard();

    expect(data.failed.sort()).toEqual(["pending", "requests"]);
  });

  it("fails completely when nothing could be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 500 })),
    );

    await expect(loadDashboard()).rejects.toThrow(
      "Could not load dashboard information.",
    );
  });
});
