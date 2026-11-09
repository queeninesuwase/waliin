export class HttpError extends Error {
  status: number;
  detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

const API_BASE = "/api";

export async function http<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 10000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API_BASE + path, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail: string | undefined;
      try {
        const body = await res.json();
        if (typeof body?.detail === "string") detail = body.detail;
      } catch {
        // the error had no JSON body
      }
      throw new HttpError(
        res.status,
        `${res.status} ${res.statusText}`,
        detail,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new HttpError(0, "The server took too long to answer");
    }
    throw new HttpError(0, "Cannot reach the server");
  } finally {
    clearTimeout(timer);
  }
}

export function errorText(e: unknown): string {
  if (e instanceof HttpError) return e.detail ?? e.message;
  return e instanceof Error ? e.message : "Something went wrong";
}
