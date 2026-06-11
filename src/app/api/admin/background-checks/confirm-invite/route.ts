import { confirmPlanBBackgroundCheckInviteSent } from "@/lib/background-check-plan-b";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/require-admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { trainerId?: string };
  try {
    body = (await req.json()) as { trainerId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const trainerId = body.trainerId?.trim();
  if (!trainerId) {
    return NextResponse.json({ error: "trainerId is required." }, { status: 400 });
  }

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      backgroundCheckInviteRequestedAt: true,
      backgroundCheckInviteSentAt: true,
      backgroundCheckStatus: true,
    },
  });
  if (!profile) {
    return NextResponse.json({ error: "Trainer profile not found." }, { status: 404 });
  }
  if (!profile.backgroundCheckInviteRequestedAt) {
    return NextResponse.json({ error: "Trainer has not requested a Checkr invite yet." }, { status: 400 });
  }
  if (profile.backgroundCheckInviteSentAt) {
    return NextResponse.json({ error: "Checkr invite was already marked as sent." }, { status: 400 });
  }

  const result = await confirmPlanBBackgroundCheckInviteSent(trainerId);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: result.message });
}
