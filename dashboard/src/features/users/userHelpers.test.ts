import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";

import type { ManagedUser } from "./api";
import {
  actionErrorMessage,
  departmentNames,
  departmentsLoadErrorMessage,
  filterUsers,
  inviteErrorMessage,
  loadErrorMessage,
  managedOnly,
  paginate,
  readUserQuery,
  roleForTab,
  writeUserQuery,
  roleName,
  showingText,
  STATUS_BADGES,
  userChanges,
} from "./userHelpers";

function user(overrides: Partial<ManagedUser>): ManagedUser {
  return {
    user_id: "u1",
    full_name: "Tigist Bekele",
    email: "tigist@hospital.et",
    role: "clinical_staff",
    department_id: "d1",
    status: "active",
    invitation_expires_at: null,
    created_at: "2026-10-26T00:00:00Z",
    ...overrides,
  };
}

const USERS = [
  user({ user_id: "1" }),
  user({
    user_id: "2",
    full_name: "Abebe Tadesse",
    email: "abebe@hospital.et",
    role: "biomedical_engineer",
    department_id: "d2",
  }),
  user({
    user_id: "3",
    full_name: null,
    email: "new@hospital.et",
    status: "invited",
  }),
  user({ user_id: "4", email: "old@hospital.et", status: "invite_expired" }),
];

describe("labels", () => {
  it("names the roles like the design", () => {
    expect(roleName("clinical_staff")).toBe("Health Worker");
    expect(roleName("biomedical_engineer")).toBe("Engineer");
  });

  it("labels every status", () => {
    expect(STATUS_BADGES.invited.label).toBe("Invitation sent");
    expect(STATUS_BADGES.active.label).toBe("Active");
    expect(STATUS_BADGES.invite_expired.label).toBe("Expired");
    expect(STATUS_BADGES.revoked.label).toBe("Deactivated");
  });
});

describe("filterUsers", () => {
  it("filters by tab", () => {
    expect(filterUsers(USERS, "all", "", "")).toHaveLength(4);
    expect(
      filterUsers(USERS, "biomedical_engineer", "", "").map((u) => u.user_id),
    ).toEqual(["2"]);
    expect(filterUsers(USERS, "pending", "", "").map((u) => u.user_id)).toEqual(
      ["3", "4"],
    );
  });

  it("searches by name or email, ignoring case", () => {
    expect(
      filterUsers(USERS, "all", "ABEBE", "").map((u) => u.user_id),
    ).toEqual(["2"]);
    expect(filterUsers(USERS, "all", "new@", "").map((u) => u.user_id)).toEqual(
      ["3"],
    );
  });

  it("filters by department", () => {
    expect(filterUsers(USERS, "all", "", "d2").map((u) => u.user_id)).toEqual([
      "2",
    ]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, index) => index + 1);

  it("splits into pages of 10", () => {
    const first = paginate(items, 1);
    expect(first.items).toHaveLength(10);
    expect(first.pageCount).toBe(3);
    expect(showingText(first.from, first.to, first.total)).toBe(
      "Showing 1–10 of 23",
    );
    const last = paginate(items, 3);
    expect(showingText(last.from, last.to, last.total)).toBe(
      "Showing 21–23 of 23",
    );
  });

  it("keeps the page in range", () => {
    expect(paginate(items, 9).page).toBe(3);
    expect(paginate([], 1).pageCount).toBe(1);
    expect(showingText(0, 0, 0)).toBe("Showing 0 of 0");
  });
});

describe("error messages come from the HTTP status", () => {
  it("for loading", () => {
    expect(loadErrorMessage(new ApiError(0, "x"))).toBe(
      "Cannot reach the server. Check your connection.",
    );
    expect(loadErrorMessage(new ApiError(500, "x"))).toBe(
      "Could not load users. Try again.",
    );
  });

  it("for departments", () => {
    expect(departmentsLoadErrorMessage(new ApiError(500, "x"))).toBe(
      "Could not load departments. Try again.",
    );
  });

  it("for inviting", () => {
    expect(inviteErrorMessage(new ApiError(409, "x"))).toBe(
      "A user with this email already exists.",
    );
    expect(inviteErrorMessage(new ApiError(503, "x"))).toBe(
      "The invitation email could not be sent. Nothing was saved. Try again.",
    );
    expect(inviteErrorMessage(new Error("x"))).toBe(
      "Could not send the invitation. Try again.",
    );
  });

  it("for actions", () => {
    expect(actionErrorMessage("revoke", new ApiError(409, "x"))).toBe(
      "This user's access is already revoked.",
    );
    expect(actionErrorMessage("resend", new ApiError(404, "x"))).toBe(
      "This user no longer exists. Refresh the list.",
    );
    expect(actionErrorMessage("reset", new ApiError(409, "x"))).toBe(
      "Only active users can get a password reset link.",
    );
  });
});

it("maps department ids to names", () => {
  const names = departmentNames([
    { department_id: "d1", department_name: "ICU" },
  ]);
  expect(names.get("d1")).toBe("ICU");
});

it("hides the health manager from the list", () => {
  const rows = managedOnly([
    ...USERS,
    user({ user_id: "9", role: "health_manager" }),
  ]);
  expect(rows.map((row) => row.user_id)).toEqual(["1", "2", "3", "4"]);
});

describe("filters in the address bar", () => {
  it("reads the filters from the URL", () => {
    const query = readUserQuery(
      new URLSearchParams("tab=pending&q=abebe&department=d1&page=2"),
    );
    expect(query).toEqual({
      tab: "pending",
      search: "abebe",
      departmentId: "d1",
      page: 2,
    });
  });

  it("falls back to safe values", () => {
    expect(readUserQuery(new URLSearchParams("tab=admin&page=-3"))).toEqual({
      tab: "all",
      search: "",
      departmentId: "",
      page: 1,
    });
  });

  it("writes only the filters that are set", () => {
    expect(
      writeUserQuery({ tab: "all", search: "  ", departmentId: "", page: 1 }),
    ).toBe("");
    expect(
      writeUserQuery({
        tab: "biomedical_engineer",
        search: "abebe",
        departmentId: "d1",
        page: 3,
      }),
    ).toBe("tab=biomedical_engineer&q=abebe&department=d1&page=3");
  });

  it("sends the role only for role tabs", () => {
    expect(roleForTab("clinical_staff")).toBe("clinical_staff");
    expect(roleForTab("pending")).toBeUndefined();
    expect(roleForTab("all")).toBeUndefined();
  });
});

describe("userChanges", () => {
  const nurse = user({ role: "clinical_staff", department_id: "d1" });

  it("sends nothing when nothing changed", () => {
    expect(
      userChanges(nurse, { role: "clinical_staff", departmentId: "d1" }),
    ).toEqual({});
  });

  it("sends only the changed fields", () => {
    expect(
      userChanges(nurse, { role: "biomedical_engineer", departmentId: "d1" }),
    ).toEqual({ role: "biomedical_engineer" });
    expect(
      userChanges(nurse, { role: "clinical_staff", departmentId: "d2" }),
    ).toEqual({ department_id: "d2" });
  });

  it("never sends an empty department", () => {
    expect(
      userChanges(nurse, { role: "clinical_staff", departmentId: "" }),
    ).toEqual({});
  });
});
