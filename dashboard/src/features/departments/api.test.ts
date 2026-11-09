import { afterEach, expect, it, vi } from "vitest";

import {
  checkDepartmentName,
  createDepartment,
  departmentErrorMessage,
  listDepartments,
  sortDepartments,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("lists the departments", async () => {
  const rows = [{ department_id: "d1", department_name: "ICU" }];
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(rows)));
  vi.stubGlobal("fetch", fetchMock);
  expect(await listDepartments()).toEqual(rows);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/equipment/departments");
});

it("adds a department", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ department_id: "d2", department_name: "ICU" }),
        { status: 201 },
      ),
    );
  vi.stubGlobal("fetch", fetchMock);
  await createDepartment({ department_name: "ICU" });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/equipment/departments");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body)).toEqual({ department_name: "ICU" });
});

it("sorts departments by name", () => {
  const sorted = sortDepartments([
    { department_id: "2", department_name: "Maternity" },
    { department_id: "1", department_name: "ICU" },
  ]);
  expect(sorted.map((d) => d.department_name)).toEqual(["ICU", "Maternity"]);
});

it("hides inactive departments", () => {
  const sorted = sortDepartments([
    { department_id: "1", department_name: "ICU", is_active: false },
    { department_id: "2", department_name: "Maternity", is_active: true },
  ]);
  expect(sorted.map((d) => d.department_name)).toEqual(["Maternity"]);
});

it("picks the error from the HTTP status", () => {
  expect(departmentErrorMessage(409)).toBe(
    "A department with this name already exists.",
  );
  expect(departmentErrorMessage(403)).toBe(
    "Only the health manager can add departments.",
  );
  expect(departmentErrorMessage(0)).toBe(
    "Cannot reach the server. Check your connection.",
  );
});

it("checks the department name", () => {
  expect(checkDepartmentName("  ")).toBe("Enter the department name.");
  expect(checkDepartmentName("x".repeat(101))).toBe(
    "Use at most 100 characters.",
  );
  expect(checkDepartmentName("x".repeat(100))).toBe(true);
  expect(checkDepartmentName("ICU")).toBe(true);
});
