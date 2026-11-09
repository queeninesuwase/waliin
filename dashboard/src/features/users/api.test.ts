import { afterEach, describe, expect, it, vi } from "vitest";

import {
  inviteUser,
  listUsers,
  resendInvite,
  revokeUser,
  sendResetLink,
  updateUser,
  usersPath,
} from "./api";

function mockFetch(body: unknown = {}, status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("users api", () => {
  it("lists users", async () => {
    const fetchMock = mockFetch([]);
    await listUsers();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/users");
    expect(init.method).toBeUndefined();
  });

  it("sends the filters as query parameters", async () => {
    const fetchMock = mockFetch([]);
    await listUsers({
      role: "biomedical_engineer",
      department_id: "d1",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/users?role=biomedical_engineer&department_id=d1",
    );
  });

  it("leaves out empty filters", () => {
    expect(usersPath({})).toBe("/users");
  });

  it("invites a user with email, role and department", async () => {
    const fetchMock = mockFetch({}, 201);
    await inviteUser({
      email: "hana@hospital.et",
      role: "clinical_staff",
      department_id: "dept-1",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/users");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      email: "hana@hospital.et",
      role: "clinical_staff",
      department_id: "dept-1",
    });
  });

  it("sends only the changed fields", async () => {
    const fetchMock = mockFetch();
    await updateUser("user-1", { role: "biomedical_engineer" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/users/user-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ role: "biomedical_engineer" });
  });

  it("calls the action endpoints", async () => {
    const fetchMock = mockFetch();
    await resendInvite("user-1");
    await revokeUser("user-1");
    await sendResetLink("user-1");
    const calls = fetchMock.mock.calls.map(([url, init]) => [url, init.method]);
    expect(calls).toEqual([
      ["/api/users/user-1/resend-invite", "POST"],
      ["/api/users/user-1/revoke", "POST"],
      ["/api/users/user-1/send-reset-link", "POST"],
    ]);
  });
});
