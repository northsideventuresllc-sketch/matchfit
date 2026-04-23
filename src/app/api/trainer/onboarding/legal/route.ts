import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { mockRecordTrainerW9Intent } from "@/lib/trainer-onboarding-mocks";
import { trainerLegalStepSchema } from "@/lib/validations/trainer-register";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = trainerLegalStepSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsed.data;

    if (body.w9Acknowledged) {
      await mockRecordTrainerW9Intent({ trainerId });
    }

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        hasSignedTOS: true,
        hasUploadedW9: body.w9Acknowledged ? true : undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save legal acknowledgements.", {
      logLabel: "[Match Fit trainer legal onboarding]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
