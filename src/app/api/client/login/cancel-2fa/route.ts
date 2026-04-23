import { clearLoginChallengeCookie } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  await clearLoginChallengeCookie();
  return NextResponse.json({ ok: true });
}
