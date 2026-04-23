import { clearTrainerSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  await clearTrainerSession();
  return NextResponse.json({ ok: true });
}
