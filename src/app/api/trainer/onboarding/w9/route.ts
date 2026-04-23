import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { mockRecordTrainerW9Intent } from "@/lib/trainer-onboarding-mocks";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";
import { trainerW9StepSchema } from "@/lib/validations/trainer-register";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = trainerW9StepSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid W-9 information.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsed.data;

    await mockRecordTrainerW9Intent({ trainerId });

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        hasUploadedW9: true,
        w9Json: JSON.stringify({
          legalName: body.legalName,
          businessName: body.businessName,
          federalTaxClassification: body.federalTaxClassification,
          addressLine1: body.addressLine1,
          addressLine2: body.addressLine2,
          city: body.city,
          state: body.state,
          zip: body.zip,
          tinType: body.tinType,
          tin: body.tin,
          submittedAt: new Date().toISOString(),
        }),
      },
    });

    await maybeActivateTrainerDashboard(trainerId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save your W-9 information.", {
      logLabel: "[Match Fit trainer w9 onboarding]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
