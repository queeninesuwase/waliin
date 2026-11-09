import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkEquipmentRequest,
  clearFaultsCache,
  fetchFaults,
  checkFaultReport,
  createFault,
  createEquipmentRequest,
  equipmentLabel,
  equipmentRequestStatus,
  faultDescription,
  fetchEquipmentOptions,
  fetchMyEquipmentRequests,
  matchesEquipment,
  newReportFor,
  outOfServiceFor,
  serviceStatus,
  wardMachines,
  requestJustification,
  statusOf,
  type Equipment,
  type Fault,
} from "./waliin";

function fault(status: string): Fault {
  return {
    fault_id: "f1",
    equipment_id: "e1",
    reported_by: "nurse",
    assigned_engineer_id: null,
    description: "Broken",
    severity: "high",
    status,
    reported_at: "2026-11-01T08:00:00Z",
    updated_at: "2026-11-01T08:00:00Z",
    closed_at: null,
  };
}

function machine(id: string, extra: Partial<Equipment> = {}): Equipment {
  return {
    equipment_id: id,
    model_name: "LCSU 4",
    equipment_category: "Suction machine",
    department_id: "mat",
    asset_tag: `TAG-${id}`,
    location: "Room 4",
    registration_status: "approved",
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
  clearFaultsCache();
});

describe("statusOf", () => {
  it("uses words clinical staff understand", () => {
    expect(statusOf(fault("reported"))).toBe("Received");
    expect(statusOf(fault("under_repair"))).toBe("In repair");
    expect(statusOf(fault("awaiting_verification"))).toBe("In repair");
    expect(statusOf(fault("awaiting_resources"))).toBe("Waiting for part");
    expect(statusOf(fault("closed"))).toBe("Back in use");
    expect(statusOf(fault("cancelled"))).toBe("Closed");
  });
});

describe("faultDescription", () => {
  it("starts with the problem so the engineer sees it first", () => {
    expect(
      faultDescription({
        problem: "Shows an error message",
        note: " E-04 ",
        usable: "no",
        impact: " Mothers wait ",
      }),
    ).toBe(
      "Shows an error message: E-04\nCan it still be used: No, it cannot be used.\nEffect on patients: Mothers wait",
    );
  });

  it("uses only the note for Other and leaves out an empty effect", () => {
    expect(
      faultDescription({
        problem: "Other",
        note: "Screen flickers",
        usable: "yes",
        impact: " ",
      }),
    ).toBe("Screen flickers\nCan it still be used: Yes, it still works.");
  });
});

describe("checkFaultReport", () => {
  it("asks for the machine, the problem and a note for Other", () => {
    const good = { equipment_id: "e1", problem: "Missing accessory", note: "" };
    expect(checkFaultReport(good)).toBeNull();
    expect(checkFaultReport({ ...good, equipment_id: "" })).toBe(
      "Choose the machine.",
    );
    expect(checkFaultReport({ ...good, problem: "" })).toBe(
      "Choose what is wrong.",
    );
    expect(checkFaultReport({ ...good, problem: "Other" })).toBe(
      "Describe what is wrong.",
    );
  });
});

describe("createFault", () => {
  it("sends a report id so a retry does not create a second report", async () => {
    const fetchMock = mockFetch({ fault_id: "f1" });

    await createFault({
      equipment_id: "e1",
      reported_by: "nurse",
      description: "Broken",
      severity: "high",
      client_report_id: "11111111-1111-4111-8111-111111111111",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.client_report_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.reported_by).toBe("nurse");
    expect(typeof body.failure_observed_at).toBe("string");
  });

  it("returns the first report when the same report was already sent", async () => {
    const first = {
      ...fault("reported"),
      fault_id: "f9",
      client_report_id: "11111111-1111-4111-8111-111111111111",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === "POST"
            ? new Response(JSON.stringify({ detail: "exists" }), {
                status: 409,
              })
            : new Response(JSON.stringify([first])),
        ),
      ),
    );

    const sent = await createFault({
      equipment_id: "e1",
      reported_by: "nurse",
      description: "Broken",
      severity: "high",
      client_report_id: "11111111-1111-4111-8111-111111111111",
    });

    expect(sent.fault_id).toBe("f9");
  });

  it("explains a failed report in plain words", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("down")));

    await expect(
      createFault({
        equipment_id: "e1",
        reported_by: "nurse",
        description: "Broken",
        severity: "high",
        client_report_id: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow("Cannot reach the server. Check your connection.");
  });
});

describe("outOfServiceFor", () => {
  it("says how long a machine has been down", () => {
    const now = Date.parse("2026-11-03T10:00:00Z");
    expect(outOfServiceFor("2026-11-03T08:00:00Z", now)).toBe("since today");
    expect(outOfServiceFor("2026-11-02T08:00:00Z", now)).toBe("for 1 day");
    expect(outOfServiceFor("2026-10-30T08:00:00Z", now)).toBe("for 4 days");
  });
});

describe("equipmentLabel", () => {
  it("shows category, model and asset tag", () => {
    expect(equipmentLabel(machine("1"))).toBe(
      "Suction machine · LCSU 4 · TAG-1",
    );
  });
});

describe("matchesEquipment", () => {
  it("finds a machine by name or asset tag", () => {
    expect(matchesEquipment(machine("1"), "suction")).toBe(true);
    expect(matchesEquipment(machine("1"), "tag-1")).toBe(true);
    expect(matchesEquipment(machine("1"), "ventilator")).toBe(false);
    expect(matchesEquipment(machine("1"), " ")).toBe(true);
  });
});

describe("fetchEquipmentOptions", () => {
  it("keeps only approved equipment in the user's department", async () => {
    const fetchMock = mockFetch([
      machine("a"),
      machine("b", { registration_status: "pending" }),
      machine("c", { department_id: "icu" }),
    ]);

    const list = await fetchEquipmentOptions("mat");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/equipment");
    expect(list.map((e) => e.equipment_id)).toEqual(["a"]);
  });

  it("explains when the list cannot be loaded", async () => {
    mockFetch({ detail: "Forbidden" }, 403);

    await expect(fetchEquipmentOptions("mat")).rejects.toThrow(
      "You do not have access to this.",
    );
  });
});

describe("ward machines", () => {
  it("names each service status", () => {
    expect(
      serviceStatus(machine("a", { service_status: "in_service" })),
    ).toEqual({
      label: "In service",
      tone: "ok",
    });
    expect(
      serviceStatus(machine("a", { service_status: undefined })).label,
    ).toBe("Not checked yet");
  });

  it("lists machines that are down first and hides retired ones", () => {
    const list = wardMachines([
      machine("1", { service_status: "in_service", equipment_category: "B" }),
      machine("2", { service_status: "retired" }),
      machine("3", {
        service_status: "out_of_service",
        equipment_category: "C",
      }),
      machine("4", { service_status: "under_maintenance" }),
    ]);

    expect(list.map((e) => e.equipment_id)).toEqual(["3", "4", "1"]);
  });

  it("opens the report form with the machine picked", () => {
    expect(newReportFor("e 1")).toBe("/requests/new?equipment=e%201");
  });
});

describe("equipment requests", () => {
  it("checks the form", () => {
    const good = {
      item: "Fetal monitor",
      quantity: 2,
      reason: "Few",
      patients: 30,
    };
    expect(checkEquipmentRequest(good)).toBeNull();
    expect(checkEquipmentRequest({ ...good, item: " " })).toBe(
      "Say which equipment your department needs.",
    );
    expect(checkEquipmentRequest({ ...good, quantity: 0 })).toBe(
      "Quantity must be at least 1.",
    );
    expect(checkEquipmentRequest({ ...good, reason: "" })).toBe(
      "Explain why your department needs it.",
    );
    expect(checkEquipmentRequest({ ...good, patients: -1 })).toBe(
      "Enter how many patients it would serve each week.",
    );
  });

  it("writes the reason, patients and urgency into the justification", () => {
    expect(
      requestJustification({
        reason: "One monitor for 12 beds",
        patients: 30,
        urgency: "urgent",
      }),
    ).toBe(
      "One monitor for 12 beds\nPatients it would serve each week: 30.\nUrgency: Urgent – patients are referred or waiting.",
    );
  });

  it("sends a new_equipment request as the signed-in user", async () => {
    const fetchMock = mockFetch({ request_id: "r1" });

    await createEquipmentRequest("nurse", {
      item: "Fetal monitor",
      quantity: 2,
      justification: "Needed",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/requests");
    expect(init.headers["user-id"]).toBe("nurse");
    const body = JSON.parse(init.body);
    expect(body.request_type).toBe("new_equipment");
    expect(body.items[0].quantity_requested).toBe(2);
  });

  it("lists only my equipment requests, newest first", async () => {
    mockFetch([
      {
        request_id: "1",
        requested_by: "nurse",
        request_type: "new_equipment",
        requested_at: "2026-10-01T00:00:00Z",
      },
      {
        request_id: "2",
        requested_by: "nurse",
        request_type: "spare_parts",
        requested_at: "2026-10-02T00:00:00Z",
      },
      {
        request_id: "3",
        requested_by: "other",
        request_type: "new_equipment",
        requested_at: "2026-10-03T00:00:00Z",
      },
      {
        request_id: "4",
        requested_by: "nurse",
        request_type: "new_equipment",
        requested_at: "2026-10-04T00:00:00Z",
      },
    ]);

    const list = await fetchMyEquipmentRequests("nurse");

    expect(list.map((r) => r.request_id)).toEqual(["4", "1"]);
  });

  it("names each request status", () => {
    const named = (status: string | null, justification = "Need it") =>
      equipmentRequestStatus({ status, justification });
    expect(named("pending")).toBe("Submitted");
    expect(named(null)).toBe("Submitted");
    expect(
      named(
        "pending",
        "Need it\n\nTechnical requirements (engineer):\n- Power",
      ),
    ).toBe("Under review");
    expect(named("returned")).toBe("More detail needed");
    expect(named("in_progress")).toBe("Sent to donors");
    expect(named("resolved")).toBe("Received");
    expect(named("rejected")).toBe("Declined");
  });
});

describe("fetchFaults", () => {
  it("shares one request between pages loading at the same time", async () => {
    const fetchMock = mockFetch([fault("reported")]);

    await Promise.all([fetchFaults(), fetchFaults(), fetchFaults()]);

    expect(fetchMock.mock.calls).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/fault-list?limit=1000");
  });

  it("asks again when fresh data is needed or the last try failed", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("down"))
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify([]))),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchFaults()).rejects.toThrow();
    await fetchFaults();
    await fetchFaults(true);

    expect(fetchMock.mock.calls).toHaveLength(3);
  });
});
