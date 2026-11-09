import type { NextStep } from "@/features/auth/api";
import { ApiError, apiFetch } from "@/lib/api/client";

export interface MfaSetup {
  secret: string;
  otpauth_uri: string;
}

export interface MfaResult {
  next_step: NextStep;
}

function post(body?: unknown): RequestInit {
  return {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export function startMfaSetup() {
  return apiFetch<MfaSetup>("/auth/mfa/setup", post());
}

export function confirmMfaSetup(code: string) {
  return apiFetch<MfaResult>("/auth/mfa/confirm", post({ code }));
}

export function verifyMfaCode(code: string) {
  return apiFetch<MfaResult>("/auth/mfa/verify", post({ code }));
}

export function mfaErrorMessage(err: unknown) {
  if (!(err instanceof ApiError)) return "Could not check the code.";
  if (err.status === 0) {
    return "Cannot reach the server. Check your connection.";
  }
  if (err.status === 400) {
    return "The code is not correct. Try the newest code.";
  }
  return err.message || "Could not check the code.";
}

export function formatSecret(secret: string) {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}
