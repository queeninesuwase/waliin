import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canEdit,
  checkRequirements,
  isResubmitted,
  markResubmitted,
  parseRequirements,
  editableItems,
  editProblem,
  requestTitle,
  updateRequest,
  hasRequirements,
  requestItemName,
  requestQuantity,
  requestStatus,
  sortNewest,
  splitJustification,
  updateJustification,
  withRequirements,
  type EngineerRequest,
} from "./requests";

function request(extra: Partial<EngineerRequest> = {}): EngineerRequest {
  return {
    request_id: "r1",
    requested_by: "nurse",
    related_fault_id: null,
    request_type: "new_equipment",
    justification: "One fetal monitor for 12 beds",
    status: "pending",
    decision_reason: null,
    requested_at: "2026-11-01T08:00:00Z",
    decided_at: null,
    resolved_at: null,
    items: [{ item_name: "Fetal monitor", quantity_requested: 2 }],
    ...extra,
  };
}

const requirements = {
  power: "220 V, 50 Hz",
  parts: "2 probes, paper rolls",
  service: "Local agent, English manual",
  training: "1 day for midwives",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("technical requirements", () => {
  it("adds the requirements under a heading and can read them back", () => {
    const text = withRequirements(
      "One fetal monitor for 12 beds",
      requirements,
    );

    expect(hasRequirements(text)).toBe(true);
    expect(splitJustification(text)).toEqual({
      reason: "One fetal monitor for 12 beds",
      requirements:
        "- Power and voltage: 220 V, 50 Hz\n- Spare parts and accessories: 2 probes, paper rolls\n- Service support and manuals: Local agent, English manual\n- Training: 1 day for midwives",
    });
  });

  it("replaces old requirements instead of adding them twice", () => {
    const once = withRequirements("Reason", requirements);
    const twice = withRequirements(once, { ...requirements, power: "110 V" });

    expect(twice.split("Technical requirements").length).toBe(2);
    expect(twice).toContain("110 V");
  });

  it("asks for every field", () => {
    expect(checkRequirements(requirements)).toBeNull();
    expect(checkRequirements({ ...requirements, power: " " })).toBe(
      "Add the power and voltage needed.",
    );
    expect(checkRequirements({ ...requirements, training: "" })).toBe(
      "Say what training users and engineers need.",
    );
  });
});

describe("request helpers", () => {
  it("names the status, item and quantity", () => {
    expect(requestStatus(request())).toBe("Waiting for manager");
    expect(requestStatus(request({ status: "returned" }))).toBe(
      "Returned for changes",
    );
    expect(requestItemName(request())).toBe("Fetal monitor");
    expect(requestQuantity(request())).toBe(2);
  });

  it("sorts newest first", () => {
    const list = sortNewest([
      request({ request_id: "old", requested_at: "2026-10-01T00:00:00Z" }),
      request({ request_id: "new", requested_at: "2026-11-02T00:00:00Z" }),
    ]);
    expect(list.map((item) => item.request_id)).toEqual(["new", "old"]);
  });

  it("saves the justification with PATCH", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateJustification("r1", "New text");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/requests/r1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ justification: "New text" });
  });
});

describe("editing a returned request", () => {
  it("fills the requirements form with the saved values", () => {
    const text = withRequirements("Reason", requirements);
    expect(parseRequirements(text)).toEqual(requirements);
  });

  it("starts the requirements form with 220 V when nothing is saved", () => {
    expect(parseRequirements("Reason only")).toEqual({
      power: "220 V, 50 Hz",
      parts: "",
      service: "",
      training: "",
    });
  });

  it("marks a corrected request as resubmitted only once", () => {
    const when = new Date("2026-11-02T10:00:00Z");
    const first = markResubmitted("Reason", when);
    const again = markResubmitted(first, when);

    expect(first).toBe("Reason\n\nResubmitted after changes on 2 Nov 2026.");
    expect(again).toBe(first);
    expect(splitJustification(first).reason).toBe("Reason");
  });

  it("keeps requirements readable after a resubmit", () => {
    const when = new Date("2026-11-02T10:00:00Z");
    const text = markResubmitted(
      withRequirements("Reason", requirements),
      when,
    );

    expect(parseRequirements(text)).toEqual(requirements);
    expect(splitJustification(text).requirements).not.toContain("Resubmitted");
  });

  it("shows a corrected returned request as waiting for the manager", () => {
    const corrected = request({
      status: "returned",
      justification: "Reason\n\nResubmitted after changes on 2 Nov 2026.",
    });

    expect(isResubmitted(corrected)).toBe(true);
    expect(requestStatus(corrected)).toBe("Resubmitted, waiting for manager");
    expect(isResubmitted(request({ status: "returned" }))).toBe(false);
  });

  it("allows edits only before the manager approves or declines", () => {
    expect(canEdit(request({ status: "pending" }))).toBe(true);
    expect(canEdit(request({ status: "returned" }))).toBe(true);
    expect(canEdit(request({ status: "approved" }))).toBe(false);
    expect(canEdit(request({ status: "rejected" }))).toBe(false);
  });

  it("keeps every item with its own quantity and part number", () => {
    const items = editableItems(
      request({
        items: [
          {
            item_name: "SpO2 cable",
            specification: "OEM 989803",
            quantity_requested: 2,
          },
          { item_name: "ECG leads", quantity_requested: 5 },
        ],
      }),
    );

    expect(items).toEqual([
      { name: "SpO2 cable", quantity: 2, specification: "OEM 989803" },
      { name: "ECG leads", quantity: 5, specification: "" },
    ]);
  });

  it("names one item with its quantity, or the first item and how many more", () => {
    expect(requestTitle(request())).toBe("Fetal monitor × 2");
    expect(
      requestTitle(
        request({
          items: [
            { item_name: "Infant warmer", quantity_requested: 1 },
            { item_name: "Heater element", quantity_requested: 2 },
          ],
        }),
      ),
    ).toBe("Infant warmer and 1 more item");
  });

  it("blocks edits the backend cannot save item by item", () => {
    expect(editProblem(request())).toBeNull();
    expect(editProblem(request({ items: [] }))).toContain("no items");
    expect(
      editProblem(
        request({
          items: [
            { item_name: "Battery", quantity_requested: 1 },
            { item_name: "battery", quantity_requested: 2 },
          ],
        }),
      ),
    ).toContain("same name");
  });

  it("saves every item separately with PATCH", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateRequest("r1", {
      request_type: "spare_parts",
      justification: "Fixed",
      items: [
        { name: "SpO2 cable", quantity: 3, specification: " " },
        { name: "ECG leads", quantity: 5, specification: "5-lead" },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/requests/r1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      request_type: "spare_parts",
      justification: "Fixed",
      items: [
        {
          item_name_or_service: "SpO2 cable",
          technical_specifications: null,
          quantity_requested: 3,
        },
        {
          item_name_or_service: "ECG leads",
          technical_specifications: "5-lead",
          quantity_requested: 5,
        },
      ],
    });
  });
});
