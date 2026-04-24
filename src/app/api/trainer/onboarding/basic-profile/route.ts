import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { normalizeTrainerSocialFields } from "@/lib/trainer-social-urls";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";
import { trainerBasicProfileSchema } from "@/lib/validations/trainer-register";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = trainerBasicProfileSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid profile.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsed.data;

    const socialNorm = normalizeTrainerSocialFields({
      socialInstagram: body.socialInstagram,
      socialTiktok: body.socialTiktok,
      socialFacebook: body.socialFacebook,
      socialLinkedin: body.socialLinkedin,
      socialOtherUrl: body.socialOtherUrl,
    });
    if (!socialNorm.ok) {
      return NextResponse.json({ error: socialNorm.error }, { status: 400 });
    }
    const s = socialNorm.value;

    await prisma.trainer.update({
      where: { id: trainerId },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        preferredName: body.preferredName.trim() || null,
        bio: body.bio || null,
        pronouns: body.pronouns.trim() || null,
        ethnicity: body.ethnicity.trim() || null,
        languagesSpoken: body.languagesSpoken.trim() || null,
        fitnessNiches: body.fitnessNiches.trim() || null,
        yearsCoaching: body.yearsCoaching.trim() || null,
        genderIdentity: body.genderIdentity.trim() || null,
        socialInstagram: s.socialInstagram,
        socialTiktok: s.socialTiktok,
        socialFacebook: s.socialFacebook,
        socialLinkedin: s.socialLinkedin,
        socialOtherUrl: s.socialOtherUrl,
      },
    });

    await maybeActivateTrainerDashboard(trainerId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save your profile.", {
      logLabel: "[Match Fit trainer basic profile]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
