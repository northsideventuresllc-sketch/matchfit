import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { isPrismaMissingColumnError, isPrismaUnknownModelFieldError } from "@/lib/prisma-missing-column";
import {
  parseTrainerDashboardQuickLinkIdsJson,
  serializeTrainerDashboardQuickLinkIds,
  sanitizeTrainerDashboardQuickLinkIds,
} from "@/lib/trainer-dashboard-quick-links";

const bodySchema = z.object({
  quickLinkIds: z.array(z.string()).max(20),
});

const QUICK_LINKS_COL = "dashboardQuickLinkIdsJson";

export async function GET() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    try {
      const profile = await prisma.trainerProfile.findUnique({
        where: { trainerId },
        select: { dashboardQuickLinkIdsJson: true },
      });
      return NextResponse.json({
        quickLinkIds: parseTrainerDashboardQuickLinkIdsJson(profile?.dashboardQuickLinkIdsJson ?? null),
      });
    } catch (e) {
      if (isPrismaMissingColumnError(e, QUICK_LINKS_COL) || isPrismaUnknownModelFieldError(e, QUICK_LINKS_COL)) {
        return NextResponse.json({ quickLinkIds: [] as string[] });
      }
      throw e;
    }
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not load quick links.", {
      logLabel: "[trainer settings quick-links GET]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const cleaned = sanitizeTrainerDashboardQuickLinkIds(parsed.data.quickLinkIds);

    try {
      await prisma.trainerProfile.update({
        where: { trainerId },
        data: { dashboardQuickLinkIdsJson: serializeTrainerDashboardQuickLinkIds(cleaned) },
      });
    } catch (e) {
      if (isPrismaMissingColumnError(e, QUICK_LINKS_COL) || isPrismaUnknownModelFieldError(e, QUICK_LINKS_COL)) {
        return NextResponse.json(
          {
            error:
              "Quick links are unavailable until Prisma migrations are applied and `npx prisma generate` has been run.",
          },
          { status: 503 },
        );
      }
      throw e;
    }

    return NextResponse.json({ ok: true, quickLinkIds: cleaned });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save quick links.", {
      logLabel: "[trainer settings quick-links PATCH]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
