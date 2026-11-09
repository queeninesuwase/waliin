import { NextResponse, type NextRequest } from "next/server";

const BACKEND_URL = (
  process.env.BACKEND_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");
const API_PREFIX = process.env.BACKEND_API_PREFIX ?? "/api/v1";

function wholeNumber(value: string | null, fallback: string) {
  return value && /^\d+$/.test(value) ? value : fallback;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const skip = wholeNumber(params.get("skip"), "0");
  const limit = wholeNumber(params.get("limit"), "1000");
  try {
    const response = await fetch(
      `${BACKEND_URL}${API_PREFIX}/faults/?skip=${skip}&limit=${limit}`,
      {
        headers: {
          accept: "application/json",
          cookie: request.headers.get("cookie") ?? "",
        },
        cache: "no-store",
        redirect: "follow",
      },
    );
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "Cannot reach the server. Check your connection." },
      { status: 502 },
    );
  }
}
