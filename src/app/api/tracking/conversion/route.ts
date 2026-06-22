import { trackServerConversion } from "@/lib/server-conversion-tracking";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  event: z.string().trim().min(1).max(80),
  userId: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(254).optional(),
  value: z.number().optional(),
  currency: z.string().trim().max(10).optional(),
});

/**
 * Server-side conversion relay (Meta CAPI + GA4 Measurement Protocol). Always returns
 * 200 — a tracking failure must never surface as an error to the caller.
 */
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: true });
    }
    await trackServerConversion(parsed.data);
  } catch (e) {
    console.error("[tracking/conversion]", e);
  }
  return NextResponse.json({ ok: true });
}
