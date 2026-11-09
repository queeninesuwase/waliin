import { afterEach, describe, expect, it, vi } from "vitest";

import { resubmitEquipment } from "./equipment";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resubmitEquipment", () => {
  it("always sends a JSON body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ equipment_id: "e1" })));
    vi.stubGlobal("fetch", fetchMock);

    await resubmitEquipment("e1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/equipment/e1/resubmit");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({});
  });

  it("sends corrections when given", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ equipment_id: "e1" })));
    vi.stubGlobal("fetch", fetchMock);

    await resubmitEquipment("e1", { location: "Delivery room 1" });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      location: "Delivery room 1",
    });
  });
});
