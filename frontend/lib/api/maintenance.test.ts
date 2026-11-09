import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addRepair,
  addTest,
  durationHours,
  formatHours,
  getMaintenanceSummary,
  levelOf,
  logRepair,
  logTest,
  releaseChecklist,
  releaseFault,
  returnToService,
  statusAfterTest,
  statusLabel,
  type RepairRecord,
} from "./maintenance";

function record(
  type: string,
  performedAt: string,
  extra: Partial<RepairRecord> = {},
): RepairRecord {
  return {
    record_id: `${type}-${performedAt}`,
    fault_id: "f1",
    equipment_id: "e1",
    record_type: type,
    performed_by: "eng",
    work_performed: null,
    parts_used: null,
    repair_started_at: null,
    repair_completed_at: null,
    test_result: null,
    test_details: null,
    authorized_for_service: false,
    performed_at: performedAt,
    released_at: null,
    ...extra,
  };
}

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

describe("durations", () => {
  it("reads ISO 8601 durations from the backend", () => {
    expect(durationHours("P1DT2H")).toBe(26);
    expect(durationHours("PT30M")).toBe(0.5);
    expect(durationHours("PT0S")).toBe(0);
    expect(durationHours(null)).toBe(0);
    expect(durationHours("nonsense")).toBe(0);
  });

  it("shows durations in a friendly way", () => {
    expect(formatHours(0)).toBe("0 h");
    expect(formatHours(0.5)).toBe("30 min");
    expect(formatHours(5)).toBe("5 h");
    expect(formatHours(50)).toBe("2 d 2 h");
    expect(formatHours(72)).toBe("3 d");
  });
});

describe("releaseChecklist", () => {
  it("is ready only when the latest functional and safety tests passed", () => {
    const records = [
      record("repair", "2026-11-01T08:00:00Z"),
      record("functional_test", "2026-11-01T09:00:00Z", {
        test_result: "fail",
      }),
      record("functional_test", "2026-11-01T10:00:00Z", {
        test_result: "pass",
      }),
      record("safety_test", "2026-11-01T10:30:00Z", { test_result: "pass" }),
    ];
    expect(releaseChecklist(records)).toEqual({
      repaired: true,
      functional: true,
      safety: true,
      released: false,
      ready: true,
    });
  });

  it("blocks release after a failed latest test", () => {
    const records = [
      record("functional_test", "2026-11-01T09:00:00Z", {
        test_result: "pass",
      }),
      record("functional_test", "2026-11-01T10:00:00Z", {
        test_result: "fail",
      }),
      record("safety_test", "2026-11-01T10:30:00Z", { test_result: "pass" }),
    ];
    expect(releaseChecklist(records).ready).toBe(false);
  });
});

describe("helpers", () => {
  it("normalises priority levels and statuses", () => {
    expect(levelOf("critical")).toBe("critical");
    expect(levelOf("unknown")).toBe("low");
    expect(statusLabel("under_repair")).toBe("Under repair");
  });
});

describe("maintenance calls", () => {
  it("logs a repair as the engineer", async () => {
    const fetchMock = mockFetch(record("repair", "2026-11-01T08:00:00Z"));
    await addRepair("f1", "eng-1", { work_performed: "Replaced fuse" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/faults/f1/repairs");
    expect(init.headers["user-id"]).toBe("eng-1");
    expect(JSON.parse(init.body).work_performed).toBe("Replaced fuse");
  });

  it("records a test", async () => {
    const fetchMock = mockFetch(record("safety_test", "2026-11-01T08:00:00Z"));
    await addTest("f1", "eng-1", {
      record_type: "safety_test",
      test_result: "pass",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/faults/f1/tests");
  });

  it("releases with an optional note", async () => {
    const fetchMock = mockFetch(record("release", "2026-11-01T08:00:00Z"));
    await releaseFault("f1", "eng-1", "  ");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      test_details: null,
    });
  });

  it("loads the maintenance summary", async () => {
    const fetchMock = mockFetch({});
    await getMaintenanceSummary();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/reports/maintenance-summary");
  });
});

describe("maintenance flow", () => {
  function routeFetch(faultAssigned: boolean) {
    const calls: string[] = [];
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url}`);
        const body =
          url.endsWith("/f1") && !init?.method
            ? {
                fault_id: "f1",
                assigned_engineer_id: faultAssigned ? "eng" : null,
                status: faultAssigned ? "assigned" : "reported",
              }
            : { fault_id: "f1", record_type: "repair" };
        return new Response(JSON.stringify(body), { status: 200 });
      });
    vi.stubGlobal("fetch", fetchMock);
    return calls;
  }

  it("assigns the fault before logging a repair and saves the new status", async () => {
    const calls = routeFetch(false);

    await logRepair("f1", "eng", { work_performed: "Replaced cable" });

    expect(calls).toEqual([
      "GET /api/faults/f1",
      "POST /api/faults/f1/assign",
      "POST /api/faults/f1/repairs",
      "POST /api/faults/f1/status",
    ]);
  });

  it("does not assign again when the fault already has an engineer", async () => {
    const calls = routeFetch(true);

    await logTest("f1", "eng", {
      record_type: "functional_test",
      test_result: "pass",
    });

    expect(calls).toEqual([
      "GET /api/faults/f1",
      "POST /api/faults/f1/tests",
      "POST /api/faults/f1/status",
    ]);
  });

  it("releases, verifies and closes the fault when returning to service", async () => {
    const calls = routeFetch(true);

    await returnToService("f1", "eng", "", false);

    expect(calls).toEqual([
      "GET /api/faults/f1",
      "POST /api/faults/f1/release",
      "POST /api/faults/f1/status",
      "POST /api/faults/f1/close",
    ]);
  });

  it("skips the release record when one already exists", async () => {
    const calls = routeFetch(true);

    await returnToService("f1", "eng", "Back on the ward", true);

    expect(calls).toEqual([
      "GET /api/faults/f1",
      "POST /api/faults/f1/status",
      "POST /api/faults/f1/close",
    ]);
  });

  it("keeps a failed test under repair", () => {
    expect(statusAfterTest("fail")).toBe("under_repair");
    expect(statusAfterTest("pass")).toBe("awaiting_verification");
  });
});
