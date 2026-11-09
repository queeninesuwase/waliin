import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildBellItems,
  loadBellSources,
  markItemsRead,
  readFailureMessage,
  readSeen,
  timeAgo,
  unreadCount,
  type BellItem,
  type BellLoad,
} from "./engineerNotifications";
import type { FaultRecord, PriorityListItem } from "./faults";
import type { EngineerRequest } from "./requests";

function fault(id: string, extra: Partial<FaultRecord> = {}): FaultRecord {
  return {
    fault_id: id,
    equipment_id: "e1",
    reported_by: "nurse",
    assigned_engineer_id: null,
    description: "Alarm does not sound\nCan it still be used: No.",
    severity: "high",
    status: "reported",
    failure_observed_at: null,
    reported_at: "2026-11-02T08:00:00Z",
    out_of_service_at: null,
    updated_at: "2026-11-02T08:00:00Z",
    closed_at: null,
    ...extra,
  };
}

function request(extra: Partial<EngineerRequest> = {}): EngineerRequest {
  return {
    request_id: "r1",
    requested_by: "eng",
    related_fault_id: null,
    request_type: "spare_parts",
    justification: "Seal worn",
    status: "approved",
    decision_reason: "Ordered from supplier",
    requested_at: "2026-11-01T08:00:00Z",
    decided_at: "2026-11-02T09:00:00Z",
    resolved_at: null,
    items: [{ item_name: "Pump seal", quantity_requested: 2 }],
    ...extra,
  };
}

function loaded(
  sources: Partial<BellLoad["sources"]>,
  failed: BellLoad["failed"] = [],
): BellLoad {
  const all = {
    notices: [],
    faults: [],
    priority: [],
    requests: [],
    ...sources,
  };
  return {
    sources: all,
    failed,
    known: (["notices", "faults", "priority", "requests"] as const).filter(
      (key) => !failed.includes(key),
    ),
  };
}

describe("buildBellItems", () => {
  it("shows unassessed faults, decisions on my requests and ward needs", () => {
    const items = buildBellItems(
      loaded({
        faults: [
          fault("new"),
          fault("ranked"),
          fault("done", { status: "closed" }),
        ],
        priority: [{ fault_id: "ranked" } as PriorityListItem],
        requests: [
          request(),
          request({
            request_id: "w1",
            requested_by: "nurse",
            requester_name: "Tigist Bekele",
            request_type: "new_equipment",
            status: "pending",
            decided_at: null,
            requested_at: "2026-11-02T07:00:00Z",
            items: [{ item_name: "Fetal monitor", quantity_requested: 2 }],
          }),
          request({ request_id: "mine-pending", status: "pending" }),
        ],
      }),
      "eng",
      new Set(),
    );

    expect(items.map((item) => item.id)).toEqual([
      "decision-r1-approved",
      "fault-new",
      "ward-w1",
    ]);
    expect(items[0].text).toBe(
      "Spare parts: Pump seal × 2. Ordered from supplier",
    );
    expect(items[1].text).toBe(
      "Alarm does not sound. Waiting for your assessment.",
    );
    expect(items[2].text).toBe(
      "Fetal monitor × 2 from Tigist Bekele. Add the technical requirements.",
    );
    expect(unreadCount(items)).toBe(3);
  });

  it("does not guess fault reports when the priority list failed", () => {
    const items = buildBellItems(
      loaded({ faults: [fault("new")] }, ["priority"]),
      "eng",
      new Set(),
    );
    expect(items).toEqual([]);
  });

  it("treats a new decision on the same request as unread again", () => {
    const seen = new Set(["decision-r1-approved"]);
    expect(
      unreadCount(
        buildBellItems(loaded({ requests: [request()] }), "eng", seen),
      ),
    ).toBe(0);
    expect(
      unreadCount(
        buildBellItems(
          loaded({ requests: [request({ status: "resolved" })] }),
          "eng",
          seen,
        ),
      ),
    ).toBe(1);
  });
});

describe("loadBellSources", () => {
  const ok =
    <T>(value: T) =>
    () =>
      Promise.resolve(value);
  const fail = () => Promise.reject(new Error("down"));

  it("reports failures and keeps the last loaded data on refresh", async () => {
    const first = await loadBellSources(
      {
        notices: ok([]),
        faults: ok([fault("a")]),
        priority: ok([]),
        requests: ok([]),
      },
      null,
    );
    const second = await loadBellSources(
      { notices: fail, faults: fail, priority: ok([]), requests: ok([]) },
      first,
    );

    expect(second.failed.sort()).toEqual(["faults", "notices"]);
    expect(second.sources.faults.map((item) => item.fault_id)).toEqual(["a"]);
    expect(second.known).toContain("faults");
  });

  it("does not pretend a source is empty when it never loaded", async () => {
    const result = await loadBellSources(
      { notices: fail, faults: ok([]), priority: ok([]), requests: ok([]) },
      null,
    );
    expect(result.known).not.toContain("notices");
  });
});

describe("timeAgo", () => {
  it("gives short relative times", () => {
    const now = Date.parse("2026-11-02T10:00:00Z");
    expect(timeAgo("2026-11-02T09:30:00Z", now)).toBe("30 min ago");
    expect(timeAgo("2026-10-31T10:00:00Z", now)).toBe("2 d ago");
  });
});

function bellItem(id: string, kind: BellItem["kind"]): BellItem {
  return {
    id,
    kind,
    title: "Title",
    text: "Text",
    at: "2026-11-02T08:00:00Z",
    unread: true,
    href: "/biomedical-engineer/requests",
  };
}

function storage(failWrites = false) {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) throw new Error("full");
      data.set(key, value);
    },
  };
}

describe("markItemsRead", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves local items and marks backend notices as read", async () => {
    vi.stubGlobal("window", { localStorage: storage() });
    const mark = vi.fn().mockResolvedValue({});

    const failed = await markItemsRead(
      [bellItem("fault-f1", "fault"), bellItem("notice-n1", "notice")],
      "eng",
      mark,
    );

    expect(failed).toEqual([]);
    expect(mark).toHaveBeenCalledWith("n1");
    expect(readSeen("eng").has("fault-f1")).toBe(true);
  });

  it("returns the notices the backend could not mark", async () => {
    vi.stubGlobal("window", { localStorage: storage() });
    const mark = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("down"));

    const failed = await markItemsRead(
      [bellItem("notice-n1", "notice"), bellItem("notice-n2", "notice")],
      "eng",
      mark,
    );

    expect(failed.map((item) => item.id)).toEqual(["notice-n2"]);
  });

  it("returns local items when they cannot be saved", async () => {
    vi.stubGlobal("window", { localStorage: storage(true) });

    const failed = await markItemsRead(
      [bellItem("decision-r1-approved", "decision")],
      "eng",
      vi.fn(),
    );

    expect(failed.map((item) => item.id)).toEqual(["decision-r1-approved"]);
  });

  it("says how many could not be marked", () => {
    expect(readFailureMessage(1)).toBe(
      "Could not mark 1 notification as read.",
    );
    expect(readFailureMessage(3)).toBe(
      "Could not mark 3 notifications as read.",
    );
  });
});
