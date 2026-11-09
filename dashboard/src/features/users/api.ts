import { apiFetch } from "@/lib/api/client";
import type { UserRole } from "@/types/enums";

export type InvitableRole = "clinical_staff" | "biomedical_engineer";

export type UserStatus = "active" | "invited" | "invite_expired" | "revoked";

export interface ManagedUser {
  user_id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  department_id: string | null;
  status: UserStatus;
  invitation_expires_at: string | null;
  created_at: string;
}

export interface InviteUserInput {
  email: string;
  role: InvitableRole;
  department_id: string;
}

export interface UpdateUserInput {
  role?: InvitableRole;
  department_id?: string;
}

export interface UserFilters {
  role?: InvitableRole;
  department_id?: string;
}

export function usersPath(filters: UserFilters = {}) {
  const params = new URLSearchParams();
  if (filters.role) params.set("role", filters.role);
  if (filters.department_id) params.set("department_id", filters.department_id);
  const query = params.toString();
  return query ? `/users?${query}` : "/users";
}

export function listUsers(filters: UserFilters = {}) {
  return apiFetch<ManagedUser[]>(usersPath(filters));
}

export function inviteUser(input: InviteUserInput) {
  return apiFetch<ManagedUser>("/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateUser(userId: string, changes: UpdateUserInput) {
  return apiFetch<ManagedUser>(`/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export function resendInvite(userId: string) {
  return apiFetch<ManagedUser>(
    `/users/${encodeURIComponent(userId)}/resend-invite`,
    { method: "POST" },
  );
}

export function revokeUser(userId: string) {
  return apiFetch<ManagedUser>(`/users/${encodeURIComponent(userId)}/revoke`, {
    method: "POST",
  });
}

export function sendResetLink(userId: string) {
  return apiFetch<{ message: string }>(
    `/users/${encodeURIComponent(userId)}/send-reset-link`,
    { method: "POST" },
  );
}
