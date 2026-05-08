import { prisma } from "@/lib/prisma";
import { sendTrainerClientDigestEmail } from "@/lib/trainer-client-digest-email";
import { getSessionTrainerId } from "@/lib/session";
import { httpStatusFromResendError } from "@/lib/resend-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ goalId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const { goalId } = await ctx.params;

    const goal = await prisma.trainerClientGoal.findFirst({
      where: { id: goalId, trainerId },
      include: {
        client: { select: { email: true, firstName: true, username: true } },
        trainer: { select: { preferredName: true, firstName: true, lastName: true, username: true } },
      },
    });
    if (!goal) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!goal.client.email) return NextResponse.json({ error: "Client has no email on file." }, { status: 400 });

    const coachName =
      goal.trainer.preferredName?.trim() ||
      [goal.trainer.firstName, goal.trainer.lastName].filter(Boolean).join(" ").trim() ||
      `@${goal.trainer.username}`;

    const subject = `Goal update from your coach (${coachName})`;
    const text = `Hi ${goal.client.firstName || goal.client.username},

Your coach ${coachName} shared a training goal with you via Match Fit.

Horizon: ${goal.horizon}
Goal: ${goal.goalText}

How you'll know it's complete:
${goal.completionCriteria}

—
This message was sent by Match Fit on behalf of your coach. Reply is not monitored on this address.`;

    await sendTrainerClientDigestEmail({
      toClientEmail: goal.client.email,
      subject,
      textBody: text,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed.";
    const status = httpStatusFromResendError(msg);
    console.error(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
