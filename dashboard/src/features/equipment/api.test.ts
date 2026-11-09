import { afterEach, describe, expect, it, vi } from "vitest";

import { listAllEquipment, mergeEquipment, type Equipment } from "./api";

function machine(id: string, status: string, createdAt: string): Equipment {
  return {
    equipment_id: id,
    manufacturer: "Mindray",
    model_name: "BeneVision N12",
    model_number: null,
    equipment_category: "Patient monitor",
    department_id: "d1",
    asset_tag: `WAL-${id}`,
    serial_number: null,
    location: "Ward 2",
    acquisition_type: "unknown",
    registration_status: status,
    installation_status: "unknown",
    service_status: "not_assessed",
    registered_by: "u1",
    approved_by: null,
    approved_at: null,
    created_at: createdAt,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mergeEquipment", () => {
  it("joins the lists without duplicates, newest first", () => {
    const old = machine("a", "approved", "2026-10-01T08:00:00Z");
    const fresh = machine("b", "pending", "2026-10-05T08:00:00Z");
    const result = mergeEquipment([old], [fresh, old]);
    expect(result.map((item) => item.equipment_id)).toEqual(["b", "a"]);
  });
});

describe("listAllEquipment", () => {
  it("loads approved and pending equipment", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.endsWith("/pending")
              ? [machine("p", "pending", "2026-10-05T08:00:00Z")]
              : [machine("a", "approved", "2026-10-01T08:00:00Z")],
          ),
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listAllEquipment();

    expect(fetchMock.mock.calls.map((call) => call[0]).sort()).toEqual([
      "/api/equipment",
      "/api/equipment/pending",
    ]);
    expect(result.map((item) => item.registration_status)).toEqual([
      "pending",
      "approved",
    ]);
  });
});
