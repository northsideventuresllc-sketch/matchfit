import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";
import { trainerPunchWindowEndMs, trainerPunchWindowStartMs } from "@/lib/session-check-in";

const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

export async function recordSessionTrainerPunchIn(args: {
  bookingId: string;
  trainerId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
}): Promise<{ ok: true } | { error: string }> {
  if (!Number.isFinite(args.latitude) || !Number.isFinite(args.longitude)) {
    return { error: "Location is required." };
  }

  const booking = await prisma.bookedTrainingSession.findFirst({
    where: { id: args.bookingId, trainerId: args.trainerId, status: "CLIENT_CONFIRMED" },
    select: { id: true, scheduledStartAt: true, scheduledEndAt: true },
  });
  if (!booking) return { error: "Session not found or not eligible for punch-in." };

  const now = Date.now();
  const windowStart = trainerPunchWindowStartMs(booking.scheduledStartAt);
  const windowEnd = trainerPunchWindowEndMs({
    scheduledStartAt: booking.scheduledStartAt,
    scheduledEndAt: booking.scheduledEndAt,
  });
  if (now < windowStart || now > windowEnd) {
    return {
      error:
        "Punch-in is only available from 15 minutes before the booked start through one hour after the booked end.",
    };
  }

  const existing = await prisma.sessionTrainerPunchIn.findUnique({
    where: { bookedTrainingSessionId: booking.id },
    select: { id: true },
  });
  if (existing) return { error: "This session was already marked as started." };

  await prisma.$transaction([
    prisma.sessionTrainerPunchIn.create({
      data: {
        bookedTrainingSessionId: booking.id,
        trainerId: args.trainerId,
        latitude: args.latitude,
        longitude: args.longitude,
        accuracyMeters: args.accuracyMeters ?? null,
        source: "WEB_GEOLOCATION",
      },
    }),
    prisma.trainerProfile.updateMany({
      where: { trainerId: args.trainerId },
      data: { consecutiveMissedSessionPunches: 0 },
    }),
  ]);

  return { ok: true };
}

export async function listTrainerPunchInsLast60Days(trainerId: string) {
  const since = new Date(Date.now() - MAX_AGE_MS);
  try {
    return await prisma.sessionTrainerPunchIn.findMany({
      where: { trainerId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        latitude: true,
        longitude: true,
        accuracyMeters: true,
        bookedTrainingSession: {
          select: {
            id: true,
            scheduledStartAt: true,
            client: { select: { username: true, preferredName: true, firstName: true } },
          },
        },
      },
    });
  } catch (e) {
    if (isPrismaMissingTableError(e, "session_trainer_punch_ins")) {
      return [];
    }
    throw e;
  }
}
