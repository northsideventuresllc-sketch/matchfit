import { NextResponse } from "next/server";
import { processOutreachFollowUpReminders } from "@/lib/outreach-lane-cron";

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
    const summary = await processOutreachFollowUpReminders();
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error("[cron outreach-follow-up-reminders]", e);
    return NextResponse.json({ error: "Cron failed." }, { status: 500 });
  }
}

/** Fires AXON follow-up reminders for due `follow_up_1`/`follow_up_2` leads; re-nudges every 24h. */
export async function GET(req: Request) {
  return runCron(req);
}

export async function POST(req: Request) {
  return runCron(req);
}
