import { NextResponse } from "next/server";
import { StripeConnectConfigError } from "./config";

export function stripeConnectApiError(e: unknown, fallback = "Request failed."): NextResponse {
  if (e instanceof StripeConnectConfigError) {
    return NextResponse.json({ error: e.message }, { status: 503 });
  }
  if (e instanceof Error && e.message) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}
