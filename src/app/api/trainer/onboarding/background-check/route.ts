import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { verifyTrainerOnboardingDevPassword } from "@/lib/trainer-dev-bypass";
import { verifyMatchFitInternalQaTrainerOnboardingBypass } from "@/lib/match-fit-internal-qa";
import { mockInitiateTrainerBackgroundCheck } from "@/lib/trainer-onboarding-mocks";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  devPassword: z.string(),
  /// Skeleton flag: pretend the trainer paid the background check fee (optional for mocks).
  mockBackgroundFeePaid: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { email: true, passwordHash: true },
    });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    const allowDev = verifyTrainerOnboardingDevPassword(parsed.success ? parsed.data.devPassword : "");
    const allowQa = parsed.success
      ? await verifyMatchFitInternalQaTrainerOnboardingBypass({
          trainerEmail: trainer.email,
          trainerPasswordHash: trainer.passwordHash,
          inputPassword: parsed.data.devPassword,
        })
      : false;
    if (!parsed.success || (!allowDev && !allowQa)) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
    }
    const { mockBackgroundFeePaid } = parsed.data;
    const feePaid = mockBackgroundFeePaid || allowQa;

    const vendor = await mockInitiateTrainerBackgroundCheck({ trainerId });

    const clearedNow = new Date();
    await prisma.trainerProfile.upsert({
      where: { trainerId },
      create: {
        trainerId,
        hasPaidBackgroundFee: feePaid,
        backgroundCheckStatus: "APPROVED",
        backgroundCheckReviewStatus: "APPROVED",
        backgroundCheckClearedAt: clearedNow,
        backgroundCheckExpiryWarningSentAt: null,
      },
      update: {
        hasPaidBackgroundFee: feePaid,
        backgroundCheckStatus: "APPROVED",
        backgroundCheckReviewStatus: "APPROVED",
        backgroundCheckClearedAt: clearedNow,
        backgroundCheckExpiryWarningSentAt: null,
      },
    });

    await maybeActivateTrainerDashboard(trainerId);

    return NextResponse.json({
      ok: true,
      mockVendor: vendor,
      backgroundCheckStatus: "APPROVED" as const,
      message: "Background screening marked APPROVED for this test profile.",
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start background check.", {
      logLabel: "[Match Fit trainer background check]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
