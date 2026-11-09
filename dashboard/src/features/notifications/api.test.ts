import { describe, expect, it } from "vitest";

import type { Equipment } from "@/features/equipment/api";
import type { ResourceRequest } from "@/features/requests/api";

import { buildBellItems, loadBellSources, timeAgo, unreadCount } from "./api";

const machine = {
  equipment_id: "e1",
  model_name: "Hamilton C1",
  asset_tag: "WAL-ICU-031",
  created_at: "2026-11-02T08:00:00Z",
} as Equipment;

const request = (id: string, status: string) =>
  ({
    id,
    request_id: id,
    requested_by: "eng",
    requester_name: "Abebe Tadesse",
    request_type: "spare_parts",
    justification: "Seal worn",
    status,
    requested_at: "2026-11-02T09:00:00Z",
    items: [{ item_name: "Pump seal", quantity_requested: 2 }],
  }) as ResourceRequest;

describe("buildBellItems", () => {
  it("combines notifications, pending registrations and pending requests, newest first", () => {
    const items = buildBellItems(
      [
        {
          notification_id: "n1",
          notification_type: "registration_decided",
          message: "Approved",
          created_at: "2026-11-01T08:00:00Z",
          read_at: null,
        },
      ],
      [machine],
      [request("r1", "pending"), request("r2", "approved")],
      new Set(),
    );

    expect(items.map((item) => item.id)).toEqual([
      "request-r1",
      "registration-e1",
      "notice-n1",
    ]);
    expect(items[0].text).toBe(
      "New request from Abebe Tadesse: Pump seal. Waiting for your decision.",
    );
    expect(items[0].href).toBe("/requests/r1");
    expect(unreadCount(items)).toBe(3);
  });

  it("counts only items not seen yet", () => {
    const items = buildBellItems(
      [
        {
          notification_id: "n1",
          notification_type: "registration_decided",
          message: "Approved",
          created_at: "2026-11-01T08:00:00Z",
          read_at: "2026-11-01T09:00:00Z",
        },
      ],
      [machine],
      [request("r1", "pending")],
      new Set(["registration-e1"]),
    );

    expect(unreadCount(items)).toBe(1);
  });
});

describe("timeAgo", () => {
  it("shows short relative times", () => {
    const now = Date.parse("2026-11-02T10:00:00Z");
    expect(timeAgo("2026-11-02T09:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-11-02T09:30:00Z", now)).toBe("30 min ago");
    expect(timeAgo("2026-11-02T05:00:00Z", now)).toBe("5 h ago");
    expect(timeAgo("2026-10-30T10:00:00Z", now)).toBe("3 d ago");
  });
});

describe("loadBellSources", () => {
  const ok =
    <T>(value: T) =>
    () =>
      Promise.resolve(value);
  const fail = () => Promise.reject(new Error("down"));

  it("reports failed sources instead of treating them as empty", async () => {
    const result = await loadBellSources(
      { notices: fail, pending: ok([machine]), requests: ok([]) },
      null,
    );

    expect(result.failed).toEqual(["notices"]);
    expect(result.known.sort()).toEqual(["pending", "requests"]);
  });

  it("keeps the last loaded items when a refresh fails", async () => {
    const first = await loadBellSources(
      {
        notices: ok([]),
        pending: ok([machine]),
        requests: ok([request("r1", "pending")]),
      },
      null,
    );
    const second = await loadBellSources(
      { notices: ok([]), pending: fail, requests: fail },
      first,
    );

    expect(second.failed.sort()).toEqual(["pending", "requests"]);
    expect(second.sources.pending).toEqual([machine]);
    expect(second.sources.requests.map((item) => item.request_id)).toEqual([
      "r1",
    ]);
  });
});
