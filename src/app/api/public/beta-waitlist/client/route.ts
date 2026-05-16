import { joinBetaClientWaitlist } from "@/lib/beta-waitlist-service";
import { getRequestClientIp } from "@/lib/request-client-ip";
import { simpleRateLimitAllow } from "@/lib/simple-rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(10).max(32),
  desiredUsername: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/),
  homeZipCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/),
  turnstileToken: z.string().optional(),
});

export async function POST(req: Request) {
  const ip = getRequestClientIp(req);
  if (!simpleRateLimitAllow(`beta-wl-client:${ip}`, 8, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
  if (!turn.ok) {
    return NextResponse.json({ error: turn.error }, { status: turn.status });
  }
  const res = await joinBetaClientWaitlist(parsed.data);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: res.id });
}
