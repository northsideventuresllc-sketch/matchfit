import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { MATCH_SERVICE_CATALOG, type MatchServiceId } from "@/lib/trainer-match-questionnaire";
import {
  migrateLegacyQuestionnaireServices,
  parseTrainerServiceOfferingsJson,
  persistTrainerServiceOfferingsWithAi,
  type TrainerServiceOfferingLine,
  type TrainerServiceOfferingsDocument,
} from "@/lib/trainer-service-offerings";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ serviceId: string }> };

const bodySchema = z.object({
  siteVisibility: z.enum(["visible", "hidden"]).optional(),
  clientBookingAvailability: z.enum(["available", "unavailable"]).optional(),
});

function isMatchServiceId(id: string): id is MatchServiceId {
  return MATCH_SERVICE_CATALOG.some((s) => s.id === id);
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { serviceId: rawId } = await ctx.params;
    const sid = decodeURIComponent(rawId ?? "").trim();
    if (!isMatchServiceId(sid)) {
      return NextResponse.json({ error: "Unknown service type." }, { status: 400 });
    }

    const json: unknown = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success || (!parsed.data.siteVisibility && !parsed.data.clientBookingAvailability)) {
      return NextResponse.json({ error: "Choose at least one visibility or availability setting." }, { status: 400 });
    }

    await migrateLegacyQuestionnaireServices(trainerId);
    const prof = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { serviceOfferingsJson: true },
    });
    const doc = parseTrainerServiceOfferingsJson(prof?.serviceOfferingsJson ?? null);
    const idx = doc.services.findIndex((s) => s.serviceId === sid);
    if (idx < 0) {
      return NextResponse.json({ error: "That service is not on your published list." }, { status: 404 });
    }

    const prev = doc.services[idx]!;
    const nextLine: TrainerServiceOfferingLine = { ...prev };
    if (parsed.data.siteVisibility) nextLine.siteVisibility = parsed.data.siteVisibility;
    if (parsed.data.clientBookingAvailability)
      nextLine.clientBookingAvailability = parsed.data.clientBookingAvailability;

    const nextDoc: TrainerServiceOfferingsDocument = {
      ...doc,
      services: doc.services.map((s, i) => (i === idx ? nextLine : s)),
    };

    const res = await persistTrainerServiceOfferingsWithAi(trainerId, nextDoc);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not update service visibility.", {
      logLabel: "[trainer service visibility]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
