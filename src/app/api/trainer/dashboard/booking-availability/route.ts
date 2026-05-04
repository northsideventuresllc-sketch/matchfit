import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { defaultTrainerBookingAvailability, trainerBookingAvailabilitySchema } from "@/lib/booking-availability";
import { normalizeUsBookingTimezone } from "@/lib/us-booking-timezones";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { bookingAvailabilityJson: true, bookingTimezone: true, clientPublicSelfBookingEnabled: true },
    });
    if (!profile) {
      return NextResponse.json({ error: "No profile." }, { status: 404 });
    }
    let document = defaultTrainerBookingAvailability();
    if (profile.bookingAvailabilityJson?.trim()) {
      try {
        const parsed = trainerBookingAvailabilitySchema.safeParse(JSON.parse(profile.bookingAvailabilityJson) as unknown);
        if (parsed.success) {
          document = { ...defaultTrainerBookingAvailability(), ...parsed.data };
        }
      } catch {
        /* keep default */
      }
    }
    return NextResponse.json({
      timezone: normalizeUsBookingTimezone(profile.bookingTimezone),
      document,
      clientPublicSelfBookingEnabled: profile.clientPublicSelfBookingEnabled,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load availability." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { profile: { select: { dashboardActivatedAt: true, hasSignedTOS: true, hasUploadedW9: true, backgroundCheckStatus: true, backgroundCheckClearedAt: true, onboardingTrackCpt: true, onboardingTrackNutrition: true, onboardingTrackSpecialist: true, certificationReviewStatus: true, nutritionistCertificationReviewStatus: true, specialistCertificationReviewStatus: true } } },
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Your trainer profile must be live." }, { status: 403 });
    }

    const json = await req.json().catch(() => null) as {
      document?: unknown;
      timezone?: string;
      clientPublicSelfBookingEnabled?: unknown;
    } | null;
    const hasDoc = json?.document != null;
    const hasSelf = typeof json?.clientPublicSelfBookingEnabled === "boolean";
    if (!hasDoc && !hasSelf) {
      return NextResponse.json({ error: "document and/or clientPublicSelfBookingEnabled required." }, { status: 400 });
    }
    let nextJson: string | undefined;
    if (hasDoc) {
      const parsed = trainerBookingAvailabilitySchema.safeParse(json.document);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid availability document." }, { status: 400 });
      }
      nextJson = JSON.stringify(parsed.data);
    }
    const tzRaw = typeof json.timezone === "string" && json.timezone.trim().length > 2 ? json.timezone.trim().slice(0, 64) : undefined;
    const tz = tzRaw ? normalizeUsBookingTimezone(tzRaw) : undefined;
    const selfBook = hasSelf ? (json!.clientPublicSelfBookingEnabled as boolean) : undefined;

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        ...(nextJson != null ? { bookingAvailabilityJson: nextJson } : {}),
        ...(tz != null ? { bookingTimezone: tz } : {}),
        ...(selfBook != null ? { clientPublicSelfBookingEnabled: selfBook } : {}),
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save availability." }, { status: 500 });
  }
}
