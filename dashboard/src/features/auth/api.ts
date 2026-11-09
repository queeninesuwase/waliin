import { ApiError, apiFetch } from "@/lib/api/client";
import type { User } from "@/types/entities";

export type NextStep = "done" | "mfa_setup" | "mfa_verify";

export interface SignInStatus extends User {
  next_step?: NextStep;
}

export const MIN_PASSWORD_LENGTH = 12;

export const DASHBOARD_ROLE = "health_manager";

export const WRONG_APP_MESSAGE =
  "This account cannot sign in to the dashboard.";

export async function login(email: string, password: string) {
  const status = await apiFetch<SignInStatus>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (status.role !== DASHBOARD_ROLE) {
    await logout().catch(() => undefined);
    throw new ApiError(403, WRONG_APP_MESSAGE);
  }
  return status;
}

export function getMe() {
  return apiFetch<SignInStatus>("/auth/me");
}

export function logout() {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function requestPasswordReset(email: string) {
  return apiFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(
  token: string,
  password: string,
  confirmPassword: string,
) {
  return apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      token,
      password,
      confirm_password: confirmPassword,
    }),
  });
}

export function newPasswordProblem(password: string, confirmPassword: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirmPassword) {
    return "The passwords do not match.";
  }
  return "";
}

export function pathAfterLogin(status: SignInStatus) {
  const step = status.next_step ?? "done";
  if (step === "mfa_setup") return "/login/setup-mfa";
  if (step === "mfa_verify") return "/login/verify";
  return "/dashboard";
}
