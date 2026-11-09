import { describe, expect, it } from "vitest";

import type { DashboardData, FaultRecord, PriorityItem } from "./api";
import {
  availability,
  availableFrom,
  daysBetween,
  departmentRows,
  durationHours,
  formatHours,
  levelCounts,
  openFaultRows,
  pendingDecisions,
  periodStats,
  requestOutlook,
  trendBuckets,
} from "./insights";

const NOW = Date.parse("2026-11-02T12:00:00Z");

function fault(id: string, extra: Partial<FaultRecord> = {}): FaultRecord {
  return {
    fault_id: id,
    equipment_id: "e1",
    reported_by: "nurse",
    assigned_engineer_id: null,
    description: "Broken",
    severity: "high",
    status: "reported",
    reported_at: "2026-11-01T08:00:00Z",
    out_of_service_at: null,
    updated_at: "2026-11-01T08:00:00Z",
    closed_at: null,
    ...extra,
  };
}

function ranked(id: string, level: string): PriorityItem {
  return {
    fault_id: id,
    equipment_id: "e1",
    equipment_name: "BeneVision N12",
    asset_tag: "WAL-ICU-001",
    department_name: "ICU",
    fault_status: "reported",
    priority_score: 8,
    priority_level: level,
    priority_explanation: "No backup",
    backup_available: false,
    reported_at: "2026-11-01T08:00:00Z",
    still_down: null,
    assigned_engineer_id: null,
  };
}

function data(extra: Partial<DashboardData> = {}): DashboardData {
  return {
    faults: [],
    priority: [],
    equipment: [],
    pendingEquipment: [],
    outOfService: [],
    departments: [],
    requests: [],
    overdue: [],
    report: null,
    failed: [],
    ...extra,
  };
}

const machine = (id: string, dept: string, service = "in_service") =>
  ({
    equipment_id: id,
    model_name: `Model ${id}`,
    asset_tag: `TAG-${id}`,
    department_id: dept,
    service_status: service,
    created_at: "2026-10-01T00:00:00Z",
  }) as DashboardData["equipment"][number];

describe("openFaultRows", () => {
  it("keeps open faults, most urgent and longest waiting first", () => {
    const rows = openFaultRows(
      data({
        faults: [
          fault("low", { reported_at: "2026-10-20T08:00:00Z" }),
          fault("crit"),
          fault("new", { equipment_id: "e2" }),
          fault("done", {
            status: "closed",
            closed_at: "2026-11-01T10:00:00Z",
          }),
        ],
        priority: [ranked("low", "low"), ranked("crit", "critical")],
        equipment: [machine("e2", "d2")],
        departments: [{ department_id: "d2", department_name: "Maternity" }],
      }),
      NOW,
    );

    expect(rows.map((row) => row.faultId)).toEqual(["crit", "low", "new"]);
    expect(rows[1].days).toBe(13);
    expect(rows[2].level).toBe("unassessed");
    expect(rows[2].department).toBe("Maternity");
  });
});

describe("levelCounts and departmentRows", () => {
  it("counts open faults per priority and department", () => {
    const rows = openFaultRows(
      data({
        faults: [fault("a"), fault("b"), fault("c", { equipment_id: "e2" })],
        priority: [ranked("a", "high"), ranked("b", "high")],
        equipment: [machine("e2", "d2")],
        departments: [{ department_id: "d2", department_name: "Maternity" }],
      }),
      NOW,
    );

    expect(levelCounts(rows)).toEqual({
      critical: 0,
      high: 2,
      medium: 0,
      low: 0,
      unassessed: 1,
    });
    const departments = departmentRows(rows);
    expect(departments.map((row) => [row.department, row.total])).toEqual([
      ["ICU", 2],
      ["Maternity", 1],
    ]);
  });
});

describe("trendBuckets", () => {
  it("puts reported and closed faults in daily buckets", () => {
    const buckets = trendBuckets(
      [
        fault("a", { reported_at: "2026-11-02T09:00:00Z" }),
        fault("b", {
          reported_at: "2026-10-30T09:00:00Z",
          status: "closed",
          closed_at: "2026-11-02T10:00:00Z",
        }),
        fault("old", { reported_at: "2026-09-01T09:00:00Z" }),
      ],
      7,
      NOW,
    );

    expect(buckets.length).toBe(7);
    expect(buckets.reduce((sum, b) => sum + b.reported, 0)).toBe(2);
    expect(buckets[6].closed).toBe(1);
  });

  it("uses weekly buckets for 90 days", () => {
    expect(trendBuckets([], 90, NOW).length).toBe(13);
  });
});

describe("periodStats", () => {
  it("counts machines back in use and their repair time", () => {
    const stats = periodStats(
      [
        fault("a", {
          status: "closed",
          reported_at: "2026-11-01T08:00:00Z",
          closed_at: "2026-11-01T20:00:00Z",
        }),
        fault("b"),
      ],
      30,
      NOW,
    );

    expect(stats.backInUse).toBe(1);
    expect(stats.reported).toBe(2);
    expect(stats.averageRepairHours).toBe(12);
  });
});

describe("availability", () => {
  it("counts machines out of service or under maintenance", () => {
    expect(
      availability(
        data({
          equipment: [
            machine("a", "d"),
            machine("b", "d", "under_maintenance"),
            machine("c", "d"),
            machine("d", "d"),
          ],
          outOfService: [machine("c", "d", "out_of_service")],
        }),
      ),
    ).toEqual({ total: 4, unavailable: 2, percent: 50 });
  });

  it("leaves out registrations that are not approved", () => {
    expect(
      availability(
        data({
          equipment: [
            machine("a", "d"),
            machine("b", "d", "out_of_service"),
            {
              ...machine("p", "d", "out_of_service"),
              registration_status: "pending",
            },
            { ...machine("r", "d"), registration_status: "returned" },
          ],
          outOfService: [machine("p", "d", "out_of_service")],
        }),
      ),
    ).toEqual({ total: 2, unavailable: 1, percent: 50 });
  });

  it("shows 100% when there is no equipment yet", () => {
    expect(availability(data()).percent).toBe(100);
  });
});

describe("requests", () => {
  const request = (id: string, type: string, status: string, at: string) =>
    ({
      id,
      request_id: id,
      requested_by: "eng",
      request_type: type,
      justification: "Needed",
      status,
      requested_at: at,
      items: [{ item_name: "Seal", quantity_requested: 2 }],
    }) as DashboardData["requests"][number];

  it("lists pending decisions oldest first", () => {
    const list = pendingDecisions([
      request("new", "spare_parts", "pending", "2026-11-02T00:00:00Z"),
      request("old", "spare_parts", "pending", "2026-10-01T00:00:00Z"),
      request("done", "spare_parts", "resolved", "2026-09-01T00:00:00Z"),
    ]);
    expect(list.map((item) => item.request_id)).toEqual(["old", "new"]);
  });

  it("groups open requests by type with item totals", () => {
    const outlook = requestOutlook([
      request("a", "spare_parts", "pending", "2026-11-01T00:00:00Z"),
      request("b", "spare_parts", "approved", "2026-11-01T00:00:00Z"),
      request("c", "new_equipment", "pending", "2026-11-01T00:00:00Z"),
      request("d", "spare_parts", "resolved", "2026-11-01T00:00:00Z"),
    ]);
    expect(outlook).toEqual([
      { type: "spare_parts", requests: 2, items: 4 },
      { type: "new_equipment", requests: 1, items: 2 },
    ]);
  });
});

describe("time helpers", () => {
  it("reads ISO durations and formats hours", () => {
    expect(durationHours("P1DT2H30M")).toBe(26.5);
    expect(durationHours("PT0S")).toBe(0);
    expect(formatHours(0.5)).toBe("30 min");
    expect(formatHours(5)).toBe("5 h");
    expect(formatHours(72)).toBe("3 days");
    expect(daysBetween("2026-10-30T12:00:00Z", NOW)).toBe(3);
  });
});

describe("allFaults", () => {
  it("still shows ranked faults when the fault list could not be loaded", () => {
    const rows = openFaultRows(
      data({ faults: [], priority: [ranked("x", "high")] }),
      NOW,
    );
    expect(rows.map((row) => [row.faultId, row.level])).toEqual([
      ["x", "high"],
    ]);
  });
});

describe("availableFrom", () => {
  it("marks metrics unavailable when one of their sources failed", () => {
    const loaded = data({ failed: ["requests"] });
    expect(availableFrom(loaded, "faults")).toBe(true);
    expect(availableFrom(loaded, "pending", "requests")).toBe(false);
  });
});
