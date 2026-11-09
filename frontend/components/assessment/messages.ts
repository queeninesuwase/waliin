import { ApiError } from "@/lib/api/client";

export function assessmentErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return "The server does not accept engineer assessments yet. Ask the backend owner to enable engineer sign-in for assessments.";
    }
    if (error.status === 0) return error.message;
    if (error.status === 404) return "This fault or engineer was not found.";
    if (error.message) return error.message;
  }
  return fallback;
}
