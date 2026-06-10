import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { trainerAgreementsSchema } from "@/lib/validations/trainer-register";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = trainerAgreementsSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: { hasSignedTOS: true },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save your acknowledgements.", {
      logLabel: "[Match Fit trainer agreements]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
