import { clearClientSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  await clearClientSession();
  return NextResponse.json({ ok: true });
}
