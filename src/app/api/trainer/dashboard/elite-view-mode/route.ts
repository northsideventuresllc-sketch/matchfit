import { NextResponse } from "next/server";
import { z } from "zod";
import { ELITE_DASHBOARD_VIEW_MODES } from "@/lib/fp-account-tier-types";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  viewMode: z.enum(ELITE_DASHBOARD_VIEW_MODES),
});

export async function POST(req: Request) {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { accountTier: true },
  });

  if (profile?.accountTier !== "elite_fitness_pro") {
    return NextResponse.json({ error: "Elite Dual-View is only available on Elite Fitness Pro." }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid view mode." }, { status: 400 });
  }

  await prisma.trainer.update({
    where: { id: trainerId },
    data: { eliteDashboardViewMode: parsed.data.viewMode },
  });

  return NextResponse.json({ ok: true, viewMode: parsed.data.viewMode });
}
