import { ApiError, apiFetch } from "./api/client";

export type UserRole =
  "health_manager" | "biomedical_engineer" | "clinical_staff";

export type NextStep = "done" | "mfa_setup" | "mfa_verify";

export interface SignInStatus {
  user_id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  department_id: string | null;
  next_step?: NextStep;
}

export const ROLE_LABELS: Record<string, string> = {
  clinical_staff: "Clinical staff",
  biomedical_engineer: "Biomedical engineer",
};

export function roleLabel(value: string | null) {
  return value ? (ROLE_LABELS[value] ?? null) : null;
}

export function getCurrentUser() {
  return apiFetch<SignInStatus>("/auth/me");
}

export function login(email: string, password: string) {
  return apiFetch<SignInStatus>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  try {
    await apiFetch<void>("/auth/logout", { method: "POST" });
  } catch {
    return;
  }
}

export function wrongRoleMessage(chosen: string | null, actual: string) {
  const chosenLabel = roleLabel(chosen);
  if (!chosenLabel || chosen === actual) return null;
  const actualLabel = roleLabel(actual);
  if (!actualLabel) {
    return `This account cannot sign in as ${chosenLabel}.`;
  }
  return `This is a ${actualLabel} account. Go back and choose ${actualLabel} to sign in.`;
}

export function pathAfterLogin(status: SignInStatus) {
  const step = status.next_step ?? "done";

  if (step === "mfa_setup") {
    return "/login/setup-mfa";
  }

  if (step === "mfa_verify") {
    return "/login/verify";
  }

  if (status.role === "biomedical_engineer") {
    return "/biomedical-engineer/dashboard";
  }

  if (status.role === "clinical_staff") {
    return "/home";
  }

  // Change this if your health manager dashboard uses another route.
  return "/";
}

export function loginErrorMessage(err: unknown) {
  if (!(err instanceof ApiError)) return "Could not sign in. Try again.";

  if (err.status === 0) {
    return "Cannot reach the server. Check your connection.";
  }

  if (err.status === 401) {
    return "Email or password is not correct.";
  }

  if (err.status === 403) {
    return "This app is for clinical staff and engineers. Health managers use the Waliin dashboard.";
  }

  if (err.status === 429) {
    return "Too many attempts. Wait a few minutes and try again.";
  }

  return "Could not sign in. Try again.";
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

export function forgotErrorMessage(err: unknown) {
  if (!(err instanceof ApiError)) return "Could not send the link. Try again.";

  if (err.status === 0) {
    return "Cannot reach the server. Check your connection.";
  }

  if (err.status === 429) {
    return "Too many requests. Wait 15 minutes and try again.";
  }

  return "Could not send the link. Try again.";
}

export function isExpiredResetLink(err: unknown) {
  return err instanceof ApiError && err.status === 400;
}

export function resetErrorMessage(err: unknown) {
  if (!(err instanceof ApiError)) {
    return "Could not change the password. Try again.";
  }

  if (err.status === 0) {
    return "Cannot reach the server. Check your connection.";
  }

  if (err.status === 400) {
    return "This reset link is invalid or has expired.";
  }

  if (err.status === 422) {
    return "Choose a stronger password with at least 12 characters.";
  }

  return "Could not change the password. Try again.";
}

export interface AcceptedInvitation {
  message: string;
  role?: UserRole;
}

export function acceptInvitation(
  token: string,
  fullName: string,
  password: string,
  confirmPassword: string,
) {
  return apiFetch<AcceptedInvitation>("/auth/accept-invite", {
    method: "POST",
    body: JSON.stringify({
      token,
      full_name: fullName,
      password,
      confirm_password: confirmPassword,
    }),
  });
}

export function pathAfterAccept(role?: string | null) {
  return role && ROLE_LABELS[role]
    ? `/login?as=${role}&welcome=1`
    : "/login?welcome=1";
}

export function acceptErrorMessage(err: unknown) {
  if (!(err instanceof ApiError)) {
    return "Could not create your account. Try again.";
  }

  if (err.status === 0) {
    return "Cannot reach the server. Check your connection.";
  }

  if (err.status === 400) {
    return "This invitation link is invalid or has expired. Ask your health manager for a new one.";
  }

  if (err.status === 422) {
    return "Choose a stronger password with at least 12 characters.";
  }

  return "Could not create your account. Try again.";
}

export interface MfaSetupResponse {
  secret: string;
  otpauth_uri: string;
}

export interface MfaResult {
  next_step: NextStep;
}

export function setupMfa() {
  return apiFetch<MfaSetupResponse>("/auth/mfa/setup", { method: "POST" });
}

export function confirmMfa(code: string) {
  return apiFetch<MfaResult>("/auth/mfa/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function verifyMfa(code: string) {
  return apiFetch<MfaResult>("/auth/mfa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function mfaErrorMessage(err: unknown) {
  if (!(err instanceof ApiError)) return "Could not check the code. Try again.";
  if (err.status === 0) {
    return "Cannot reach the server. Check your connection.";
  }
  if (err.status === 400) {
    return "The code is not correct. Try the newest code in your app.";
  }
  return "Could not check the code. Try again.";
}

export function formatSecret(secret: string) {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}
