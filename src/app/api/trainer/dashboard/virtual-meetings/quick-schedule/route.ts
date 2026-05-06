import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { createTrainerBookingInvite } from "@/lib/trainer-client-booking-service";
import { trainerSyncBookingVideoFromOAuth } from "@/lib/trainer-booking-video-sync";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { isTrainerClientInteractionRestricted } from "@/lib/user-block-queries";
import type { VideoConferenceProviderKey } from "@/lib/trainer-video-oauth-state";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  clientUsername: z.string().trim().min(1).max(80),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  note: z.string().trim().max(500).optional(),
  platform: z.enum(["GOOGLE", "ZOOM", "MICROSOFT"]).optional(),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        profile: {
          select: {
            dashboardActivatedAt: true,
            hasSignedTOS: true,
            hasUploadedW9: true,
            backgroundCheckStatus: true,
            backgroundCheckClearedAt: true,
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
          },
        },
      },
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Your trainer profile must be live." }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const handle = parsed.data.clientUsername.trim();
    const client = await prisma.client.findUnique({
      where: { username: handle },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client username not found." }, { status: 404 });
    }
    if (await isTrainerClientInteractionRestricted(trainerId, client.id)) {
      return NextResponse.json({ error: "Messaging is restricted for this client." }, { status: 403 });
    }

    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);

    const inv = await createTrainerBookingInvite({
      trainerId,
      clientId: client.id,
      startsAt,
      endsAt,
      note: parsed.data.note,
      sessionDelivery: "VIRTUAL",
    });
    if ("error" in inv) {
      return NextResponse.json({ error: inv.error }, { status: 400 });
    }

    let videoWarning: string | null = null;
    if (parsed.data.platform) {
      const sync = await trainerSyncBookingVideoFromOAuth({
        trainerId,
        bookingId: inv.bookingId,
        provider: parsed.data.platform as VideoConferenceProviderKey,
      });
      if ("error" in sync) {
        videoWarning = sync.error;
      }
    }

    return NextResponse.json({ ok: true, bookingId: inv.bookingId, videoWarning });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not schedule." }, { status: 500 });
  }
}
