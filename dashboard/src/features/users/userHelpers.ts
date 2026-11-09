import { ApiError } from "@/lib/api/client";
import type { UserRole } from "@/types/enums";

import type {
  InvitableRole,
  ManagedUser,
  UpdateUserInput,
  UserStatus,
} from "./api";

export const PAGE_SIZE = 10;

export const ROLE_OPTIONS: {
  value: InvitableRole;
  label: string;
  description: string;
}[] = [
  {
    value: "clinical_staff",
    label: "Health Worker",
    description: "Report issues and manage equipment",
  },
  {
    value: "biomedical_engineer",
    label: "Engineer",
    description: "Maintain equipment and resolve faults",
  },
];

const ROLE_NAMES: Record<UserRole, string> = {
  clinical_staff: "Health Worker",
  biomedical_engineer: "Engineer",
  health_manager: "Health Manager",
};

export function roleName(role: UserRole) {
  return ROLE_NAMES[role] ?? role;
}

export const STATUS_BADGES: Record<
  UserStatus,
  { label: string; className: string }
> = {
  invited: {
    label: "Invitation sent",
    className: "bg-amber-100 text-amber-800",
  },
  active: { label: "Active", className: "bg-green-100 text-green-800" },
  invite_expired: { label: "Expired", className: "bg-red-100 text-red-700" },
  revoked: { label: "Deactivated", className: "bg-rose text-brand" },
};

export type UserTab =
  "all" | "clinical_staff" | "biomedical_engineer" | "pending";

export const USER_TABS: { value: UserTab; label: string }[] = [
  { value: "all", label: "All users" },
  { value: "clinical_staff", label: "Health Workers" },
  { value: "biomedical_engineer", label: "Engineers" },
  { value: "pending", label: "Pending invites" },
];

export function managedOnly(users: ManagedUser[]) {
  return users.filter((user) => user.role !== "health_manager");
}

export function isPending(status: UserStatus) {
  return status === "invited" || status === "invite_expired";
}

export function filterUsers(
  users: ManagedUser[],
  tab: UserTab,
  search: string,
  departmentId: string,
) {
  const term = search.trim().toLowerCase();
  return users.filter((user) => {
    if (tab === "pending" && !isPending(user.status)) return false;
    if (tab !== "all" && tab !== "pending" && user.role !== tab) return false;
    if (departmentId && user.department_id !== departmentId) return false;
    if (!term) return true;
    return (
      user.email.toLowerCase().includes(term) ||
      (user.full_name ?? "").toLowerCase().includes(term)
    );
  });
}

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * size;
  const pageItems = items.slice(start, start + size);
  return {
    items: pageItems,
    page: current,
    pageCount,
    from: items.length ? start + 1 : 0,
    to: start + pageItems.length,
    total: items.length,
  };
}

export function showingText(from: number, to: number, total: number) {
  return total ? `Showing ${from}–${to} of ${total}` : "Showing 0 of 0";
}

const OFFLINE = "Cannot reach the server. Check your connection.";

function statusOf(err: unknown) {
  return err instanceof ApiError ? err.status : -1;
}

export function loadErrorMessage(err: unknown) {
  return statusOf(err) === 0 ? OFFLINE : "Could not load users. Try again.";
}

export function departmentsLoadErrorMessage(err: unknown) {
  return statusOf(err) === 0
    ? OFFLINE
    : "Could not load departments. Try again.";
}

export function inviteErrorMessage(err: unknown) {
  switch (statusOf(err)) {
    case 0:
      return OFFLINE;
    case 409:
      return "A user with this email already exists.";
    case 422:
      return "Check the details and try again.";
    case 503:
      return "The invitation email could not be sent. Nothing was saved. Try again.";
    default:
      return "Could not send the invitation. Try again.";
  }
}

export type UserAction = "update" | "resend" | "revoke" | "reset";

const CONFLICT_MESSAGES: Record<UserAction, string> = {
  update:
    "The role cannot change while this user has work recorded under the current role.",
  resend: "This invitation can no longer be resent.",
  revoke: "This user's access is already revoked.",
  reset: "Only active users can get a password reset link.",
};

export function actionErrorMessage(action: UserAction, err: unknown) {
  switch (statusOf(err)) {
    case 0:
      return OFFLINE;
    case 404:
      return "This user no longer exists. Refresh the list.";
    case 409:
      return CONFLICT_MESSAGES[action];
    case 422:
      return "Check the details and try again.";
    case 503:
      return "The email could not be sent. Try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

export function departmentNames(
  departments: { department_id: string; department_name: string }[],
) {
  return new Map(
    departments.map((department) => [
      department.department_id,
      department.department_name,
    ]),
  );
}

export interface UserQuery {
  tab: UserTab;
  search: string;
  departmentId: string;
  page: number;
}

const TAB_VALUES = new Set<string>(USER_TABS.map((option) => option.value));

export function readUserQuery(params: { get(name: string): string | null }) {
  const tab = params.get("tab") ?? "all";
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    tab: (TAB_VALUES.has(tab) ? tab : "all") as UserTab,
    search: params.get("q") ?? "",
    departmentId: params.get("department") ?? "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function writeUserQuery(query: UserQuery) {
  const params = new URLSearchParams();
  if (query.tab !== "all") params.set("tab", query.tab);
  const search = query.search.trim();
  if (search) params.set("q", search);
  if (query.departmentId) params.set("department", query.departmentId);
  if (query.page > 1) params.set("page", String(query.page));
  return params.toString();
}

export function roleForTab(tab: UserTab) {
  return tab === "clinical_staff" || tab === "biomedical_engineer"
    ? tab
    : undefined;
}

export interface EditUserValues {
  role: InvitableRole;
  departmentId: string;
}

export function userChanges(user: ManagedUser, values: EditUserValues) {
  const changes: UpdateUserInput = {};
  if (values.role && values.role !== user.role) changes.role = values.role;
  if (values.departmentId && values.departmentId !== user.department_id) {
    changes.department_id = values.departmentId;
  }
  return changes;
}
