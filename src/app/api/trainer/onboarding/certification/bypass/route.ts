import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { verifyTrainerOnboardingDevPassword } from "@/lib/trainer-dev-bypass";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  devPassword: z.string(),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || !verifyTrainerOnboardingDevPassword(parsed.data.devPassword)) {
      return NextResponse.json({ error: "Incorrect development password." }, { status: 403 });
    }

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        certificationReviewStatus: "APPROVED",
      },
    });

    await maybeActivateTrainerDashboard(trainerId);

    return NextResponse.json({ ok: true, certificationReviewStatus: "APPROVED" as const });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not bypass certification.", {
      logLabel: "[Match Fit trainer certification bypass]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
