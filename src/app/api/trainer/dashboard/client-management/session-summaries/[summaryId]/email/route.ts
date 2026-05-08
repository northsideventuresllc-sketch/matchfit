import { prisma } from "@/lib/prisma";
import { sendTrainerClientDigestEmail } from "@/lib/trainer-client-digest-email";
import { getSessionTrainerId } from "@/lib/session";
import { httpStatusFromResendError } from "@/lib/resend-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ summaryId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const { summaryId } = await ctx.params;

    const row = await prisma.trainerClientSessionSummary.findFirst({
      where: { id: summaryId, trainerId },
      include: {
        client: { select: { email: true, firstName: true, username: true } },
        trainer: { select: { preferredName: true, firstName: true, lastName: true, username: true } },
      },
    });
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!row.client.email) return NextResponse.json({ error: "Client has no email on file." }, { status: 400 });

    const coachName =
      row.trainer.preferredName?.trim() ||
      [row.trainer.firstName, row.trainer.lastName].filter(Boolean).join(" ").trim() ||
      `@${row.trainer.username}`;

    const when = row.occurredAt.toLocaleString();
    const subject = `Session summary from ${coachName}`;
    const text = `Hi ${row.client.firstName || row.client.username},

Your coach ${coachName} sent you a session summary via Match Fit.

When: ${when}

Notes:
${row.body}

—
Sent by Match Fit on behalf of your coach.`;

    await sendTrainerClientDigestEmail({
      toClientEmail: row.client.email,
      subject,
      textBody: text,
    });

    await prisma.trainerClientSessionSummary.update({
      where: { id: summaryId },
      data: { emailedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed.";
    const status = httpStatusFromResendError(msg);
    console.error(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
