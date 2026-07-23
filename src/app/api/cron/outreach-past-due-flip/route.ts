import { NextResponse } from "next/server";
import { processOutreachPastDueFlip } from "@/lib/outreach-lane-cron";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

async function runCron(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const summary = await processOutreachPastDueFlip();
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error("[cron outreach-past-due-flip]", e);
    return NextResponse.json({ error: "Cron failed." }, { status: 500 });
  }
}

/** Flips `today`-lane leads with a past `queuedForDate` (America/New_York) into `past_due`. */
export async function GET(req: Request) {
  return runCron(req);
}

export async function POST(req: Request) {
  return runCron(req);
}
