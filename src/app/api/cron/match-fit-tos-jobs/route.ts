import { NextResponse } from "next/server";
import { runMatchFitTosCronJobs } from "@/lib/match-fit-tos-cron";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

/** Scheduled jobs: background-check renewal notices, session auto-complete, DIY refund alerts. */
export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const summary = await runMatchFitTosCronJobs();
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error("[cron match-fit-tos-jobs]", e);
    return NextResponse.json({ error: "Cron failed." }, { status: 500 });
  }
}
