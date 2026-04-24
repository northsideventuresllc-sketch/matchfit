import { prisma } from "@/lib/prisma";
import { verifyOtp } from "@/lib/otp";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { RESEND_ONBOARDING_FROM, sendResendEmail } from "@/lib/resend-client";
import { getSessionTrainerId } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
});

type W9Stored = {
  legalName?: string;
  businessName?: string;
  federalTaxClassification?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  tinType?: string;
  tin?: string;
  submittedAt?: string;
};

function formatW9EmailBody(data: W9Stored): string {
  const lines = [
    "Below is a copy of the W-9 information you have on file with Match Fit.",
    "",
    `Legal name: ${data.legalName ?? "—"}`,
    `Business name (if any): ${data.businessName ?? "—"}`,
    `Federal tax classification: ${data.federalTaxClassification ?? "—"}`,
    `Address: ${data.addressLine1 ?? "—"}`,
    data.addressLine2 ? `Address line 2: ${data.addressLine2}` : null,
    `City, state, ZIP: ${data.city ?? "—"}, ${data.state ?? "—"} ${data.zip ?? ""}`.trim(),
    `TIN type: ${data.tinType ?? "—"}`,
    `TIN: ${data.tin ?? "—"}`,
    data.submittedAt ? `Submitted at: ${data.submittedAt}` : null,
    "",
    "If you did not request this copy, change your password and contact support.",
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid code." }, { status: 400 });
    }
    const { code } = parsed.data;

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { email: true },
    });
    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        hasUploadedW9: true,
        w9Json: true,
        w9SelfServeEmailOtpHash: true,
        w9SelfServeEmailOtpExpires: true,
      },
    });

    if (!trainer || !profile?.hasUploadedW9 || !profile.w9Json?.trim()) {
      return NextResponse.json({ error: "No W-9 on file." }, { status: 400 });
    }

    const hash = profile.w9SelfServeEmailOtpHash;
    const exp = profile.w9SelfServeEmailOtpExpires;
    if (!hash || !exp || exp.getTime() < Date.now()) {
      return NextResponse.json({ error: "Code expired or not requested. Request a new code." }, { status: 400 });
    }

    if (!verifyOtp(code, hash)) {
      return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
    }

    let w9: W9Stored = {};
    try {
      w9 = JSON.parse(profile.w9Json) as W9Stored;
    } catch {
      return NextResponse.json({ error: "Stored W-9 data could not be read." }, { status: 500 });
    }

    const text = formatW9EmailBody(w9);
    const to = trainer.email.trim().toLowerCase();

    if (!process.env.RESEND_API_KEY?.trim() && process.env.NODE_ENV === "development") {
      console.info(`[Match Fit][W-9 self-email DEV] to ${to}\n${text}`);
    } else {
      await sendResendEmail({
        from: RESEND_ONBOARDING_FROM,
        to,
        subject: "Your Match Fit W-9 information on file",
        text,
      });
    }

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        w9SelfServeEmailOtpHash: null,
        w9SelfServeEmailOtpExpires: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not send W-9 email.", {
      logLabel: "[Match Fit trainer w9-email complete]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
