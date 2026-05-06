import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";

const bodySchema = z.object({
  clientsCanPurchaseServicesFromProfile: z.boolean(),
});

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

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: { clientsCanPurchaseServicesFromProfile: parsed.data.clientsCanPurchaseServicesFromProfile },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not update purchase preference.", {
      logLabel: "[trainer settings service purchases]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
