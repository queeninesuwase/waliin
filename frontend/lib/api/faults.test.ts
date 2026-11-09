import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildFaultRows,
  checkResourceRequest,
  createAssessment,
  createResourceRequest,
  getAssessments,
  type FaultEquipment,
  type FaultRecord,
  type PriorityListItem,
} from "./faults";

function fault(id: string, extra: Partial<FaultRecord> = {}): FaultRecord {
  return {
    fault_id: id,
    equipment_id: "e1",
    reported_by: "nurse",
    assigned_engineer_id: null,
    description: `Problem ${id}`,
    severity: "high",
    status: "reported",
    failure_observed_at: null,
    reported_at: "2026-11-01T08:00:00Z",
    out_of_service_at: null,
    updated_at: "2026-11-01T08:00:00Z",
    closed_at: null,
    ...extra,
  };
}

function ranked(id: string, level: string, score: number): PriorityListItem {
  return {
    fault_id: id,
    equipment_id: "e1",
    equipment_name: "BeneVision N12",
    asset_tag: "WAL-ICU-001",
    department_name: "ICU",
    fault_status: "reported",
    priority_score: score,
    priority_level: level,
    priority_explanation: "No backup",
    severity_factor: 3,
    clinical_criticality: 3,
    backup_available: false,
    reported_at: "2026-11-01T08:00:00Z",
    downtime: null,
    still_down: null,
    assigned_engineer_id: null,
  };
}

const monitor: FaultEquipment = {
  equipment_id: "e1",
  manufacturer: "Mindray",
  model_name: "BeneVision N12",
  equipment_category: "Patient monitor",
  asset_tag: "WAL-ICU-001",
  serial_number: null,
  location: "ICU room 2",
  department_id: "d1",
  acquisition_type: "donated",
  service_status: "in_service",
};

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

describe("buildFaultRows", () => {
  it("shows faults that have no assessment yet, first", () => {
    const rows = buildFaultRows(
      [
        fault("a", { reported_at: "2026-11-01T08:00:00Z" }),
        fault("b", { reported_at: "2026-11-01T09:00:00Z" }),
      ],
      [ranked("a", "low", 3)],
      new Map([["e1", monitor]]),
      new Map([["d1", "ICU"]]),
    );

    expect(rows.map((row) => row.faultId)).toEqual(["b", "a"]);
    expect(rows[0].assessed).toBe(false);
    expect(rows[0].priorityLevel).toBeNull();
    expect(rows[0].equipmentName).toBe("BeneVision N12");
    expect(rows[0].department).toBe("ICU");
    expect(rows[1].assessed).toBe(true);
    expect(rows[1].priorityLevel).toBe("low");
  });

  it("orders assessed faults from critical to low", () => {
    const rows = buildFaultRows(
      [fault("low"), fault("crit"), fault("med")],
      [
        ranked("low", "low", 2),
        ranked("crit", "critical", 9),
        ranked("med", "medium", 5),
      ],
      new Map(),
      new Map(),
    );

    expect(rows.map((row) => row.faultId)).toEqual(["crit", "med", "low"]);
  });

  it("copes with equipment that could not be loaded", () => {
    const rows = buildFaultRows(
      [fault("a")],
      [],
      new Map([["e1", null]]),
      new Map(),
    );

    expect(rows[0].equipmentName).toBe("Unknown equipment");
    expect(rows[0].assetTag).toBe("");
    expect(rows[0].department).toBe("");
  });
});

describe("checkResourceRequest", () => {
  const good = {
    request_type: "spare_parts" as const,
    justification: "Cable broken",
    related_fault_id: "f1",
    items: [
      {
        item_name_or_service: "SpO2 cable",
        technical_specifications: null,
        quantity_requested: 1,
      },
    ],
  };

  it("accepts a complete request", () => {
    expect(checkResourceRequest(good)).toBeNull();
  });

  it("asks for a reason, an item and a quantity", () => {
    expect(checkResourceRequest({ ...good, justification: " " })).toBe(
      "Explain why this is needed.",
    );
    expect(
      checkResourceRequest({
        ...good,
        items: [{ ...good.items[0], item_name_or_service: "" }],
      }),
    ).toBe("Name the part, service or machine you need.");
    expect(
      checkResourceRequest({
        ...good,
        items: [{ ...good.items[0], quantity_requested: 0 }],
      }),
    ).toBe("Quantity must be at least 1.");
  });
});

describe("fault API calls", () => {
  it("sends the engineer id with assessments", async () => {
    const fetchMock = mockFetch([]);

    await getAssessments("f1", "eng-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/faults/f1/assessments");
    expect(init.headers["X-Engineer-Id"]).toBe("eng-1");
  });

  it("posts a new assessment through the proxy", async () => {
    const fetchMock = mockFetch({ priority_score: 8 }, 201);

    await createAssessment("f1", "eng-1", {
      findings: "Cable broken",
      condition: "Not working",
      recommended_action: "Replace cable",
      severity_factor: 3,
      clinical_criticality: 3,
      backup_available: false,
      priority_level: "critical",
      priority_explanation: "No backup",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/faults/f1/assessments");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Engineer-Id"]).toBe("eng-1");
    expect(JSON.parse(init.body).priority_level).toBe("critical");
  });

  it("sends resource requests as the engineer", async () => {
    const fetchMock = mockFetch({ request_id: "r1" });

    await createResourceRequest("eng-1", {
      request_type: "spare_parts",
      justification: "Cable broken",
      related_fault_id: "f1",
      items: [
        {
          item_name_or_service: "SpO2 cable",
          technical_specifications: null,
          quantity_requested: 1,
        },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/requests");
    expect(init.headers["user-id"]).toBe("eng-1");
  });
});

describe("buildFaultRows departments", () => {
  it("borrows the department from another ranked fault on the same machine", () => {
    const rows = buildFaultRows(
      [fault("closed", { status: "closed" }), fault("open")],
      [ranked("open", "high", 7)],
      new Map([["e1", { ...monitor, department_id: "other" }]]),
      new Map(),
    );

    expect(rows.find((row) => row.faultId === "closed")?.department).toBe(
      "ICU",
    );
  });
});
