import { NextResponse } from "next/server";

/** Public VAPID key for `pushManager.subscribe` (safe to expose). */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  return NextResponse.json({
    configured: Boolean(publicKey),
    publicKey: publicKey || null,
  });
}
