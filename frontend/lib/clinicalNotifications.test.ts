import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildClinicalItems,
  loadClinicalSources,
  markClinicalRead,
  readSeen,
  unreadCount,
  type ClinicalItem,
  type ClinicalLoad,
  type ClinicalSources,
} from "./clinicalNotifications";
import type { EquipmentRequest, Fault, Notice } from "./waliin";

const NURSE = "nurse-1";

function fault(id: string, status: string, extra: Partial<Fault> = {}): Fault {
  return {
    fault_id: id,
    equipment_id: "e1",
    reported_by: NURSE,
    assigned_engineer_id: "eng",
    description:
      "Does not turn on\nCan it still be used: No, it cannot be used.",
    severity: "high",
    status,
    reported_at: "2026-11-01T08:00:00Z",
    updated_at: "2026-11-01T09:00:00Z",
    closed_at: null,
    ...extra,
  };
}

function request(
  id: string,
  status: string,
  extra: Partial<EquipmentRequest> = {},
): EquipmentRequest {
  return {
    request_id: id,
    requested_by: NURSE,
    request_type: "new_equipment",
    justification: "Need it",
    status,
    decision_reason: null,
    requested_at: "2026-11-01T07:00:00Z",
    decided_at: "2026-11-01T10:00:00Z",
    resolved_at: null,
    items: [
      {
        item_id: "i1",
        item_name_or_service: "Fetal monitor",
        quantity_requested: 2,
      },
    ],
    ...extra,
  };
}

const notice: Notice = {
  notification_id: "n1",
  notification_type: "fault_status_changed",
  message: "Your fault was updated",
  created_at: "2026-11-01T11:00:00Z",
  read_at: null,
};

function loaded(sources: Partial<ClinicalSources>): ClinicalLoad {
  return {
    sources: { notices: [], faults: [], requests: [], ...sources },
    failed: [],
    known: ["notices", "faults", "requests"],
  };
}

describe("buildClinicalItems", () => {
  it("tells the reporter when their machine moves on", () => {
    const items = buildClinicalItems(
      loaded({
        faults: [
          fault("f1", "reported"),
          fault("f2", "under_repair"),
          fault("f3", "awaiting_resources"),
          fault("f4", "closed", { closed_at: "2026-11-01T12:00:00Z" }),
          fault("f5", "under_repair", { reported_by: "someone-else" }),
        ],
      }),
      NURSE,
      new Set(),
    );

    expect(items.map((item) => item.title)).toEqual([
      "Machine is back in use",
      "The engineer is working on it",
      "Waiting for a spare part",
    ]);
    expect(items[0].text).toBe("Does not turn on");
    expect(items[0].href).toBe("/requests/f4");
  });

  it("shows decisions on my equipment requests only", () => {
    const items = buildClinicalItems(
      loaded({
        requests: [
          request("r1", "pending"),
          request("r2", "rejected", {
            decision_reason: "A working one is in ICU.",
          }),
          request("r3", "approved", { requested_by: "other" }),
          request("r4", "approved", { request_type: "spare_parts" }),
        ],
      }),
      NURSE,
      new Set(),
    );

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Equipment request: Declined");
    expect(items[0].text).toBe("Fetal monitor. A working one is in ICU.");
  });

  it("keeps read items read and counts only unread ones", () => {
    const items = buildClinicalItems(
      loaded({
        notices: [notice, { ...notice, notification_id: "n2", read_at: "x" }],
        faults: [fault("f2", "under_repair")],
      }),
      NURSE,
      new Set(["fault-f2-In repair"]),
    );

    expect(unreadCount(items)).toBe(1);
    expect(items.find((item) => item.kind === "fault")?.unread).toBe(false);
  });

  it("brings a seen fault back as new when its status changes", () => {
    const items = buildClinicalItems(
      loaded({ faults: [fault("f2", "closed")] }),
      NURSE,
      new Set(["fault-f2-In repair"]),
    );

    expect(unreadCount(items)).toBe(1);
  });
});

describe("loadClinicalSources", () => {
  it("names what failed and keeps what was loaded before", async () => {
    const first = await loadClinicalSources(
      {
        notices: async () => [notice],
        faults: async () => [fault("f2", "under_repair")],
        requests: async () => [],
      },
      null,
    );

    const second = await loadClinicalSources(
      {
        notices: async () => [],
        faults: async () => {
          throw new Error("down");
        },
        requests: async () => {
          throw new Error("down");
        },
      },
      first,
    );

    expect(second.failed.sort()).toEqual(["faults", "requests"]);
    expect(second.known.sort()).toEqual(["faults", "notices", "requests"]);
    expect(second.sources.faults).toHaveLength(1);
  });

  it("does not pretend a source loaded when there is nothing to keep", async () => {
    const result = await loadClinicalSources(
      {
        notices: async () => {
          throw new Error("down");
        },
        faults: async () => {
          throw new Error("down");
        },
        requests: async () => {
          throw new Error("down");
        },
      },
      null,
    );

    expect(result.known).toEqual([]);
    expect(result.failed).toHaveLength(3);
  });
});

function clinicalItem(id: string, kind: ClinicalItem["kind"]): ClinicalItem {
  return {
    id,
    kind,
    title: "Title",
    text: "Text",
    at: "2026-11-02T08:00:00Z",
    unread: true,
    href: "/notifications",
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

describe("markClinicalRead", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks everything read when saving works", async () => {
    vi.stubGlobal("window", { localStorage: storage() });
    const mark = vi.fn().mockResolvedValue({});

    const failed = await markClinicalRead(
      [
        clinicalItem("fault-f1-In repair", "fault"),
        clinicalItem("notice-n1", "notice"),
      ],
      NURSE,
      mark,
    );

    expect(failed).toEqual([]);
    expect(mark).toHaveBeenCalledWith("n1");
    expect(readSeen(NURSE).has("fault-f1-In repair")).toBe(true);
  });

  it("returns what could not be saved so it stays unread", async () => {
    vi.stubGlobal("window", { localStorage: storage(true) });
    const mark = vi.fn().mockRejectedValue(new Error("down"));

    const failed = await markClinicalRead(
      [
        clinicalItem("request-r1-Declined", "request"),
        clinicalItem("notice-n1", "notice"),
      ],
      NURSE,
      mark,
    );

    expect(failed.map((item) => item.id).sort()).toEqual([
      "notice-n1",
      "request-r1-Declined",
    ]);
  });
});
