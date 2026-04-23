import { clearClientSession } from "@/lib/session";
import { type NextRequest, NextResponse } from "next/server";

function redirectTarget(req: NextRequest, raw: string | null): URL {
  const fallback = new URL("/client", req.url);
  if (!raw || typeof raw !== "string") return fallback;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  try {
    return new URL(t, req.url);
  } catch {
    return fallback;
  }
}

/** Clears client session cookie (Route Handler — cookies() may be modified). */
export async function GET(req: NextRequest) {
  const next = redirectTarget(req, req.nextUrl.searchParams.get("redirect"));
  await clearClientSession();
  return NextResponse.redirect(next, 302);
}
