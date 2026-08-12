import { randomBytes } from "crypto";
import { findTrainerForPasswordReset } from "@/lib/forgot-password-verify";
import { deliverPasswordResetEmail } from "@/lib/deliver-password-reset-email";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { signPasswordChangeToken } from "@/lib/password-change-jwt";
import { prisma } from "@/lib/prisma";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  username: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  turnstileToken: z.string().optional(),
});

/**
 * Requires the FULL combination of username + email + phone to match the same coach account —
 * any one field being wrong sends nothing (JB, 2026-08-05). The response is identical whether
 * or not an account matched, so this endpoint can never be used to discover which emails,
 * usernames, or phone numbers exist on the platform.
 */
const GENERIC_RESPONSE = {
  ok: true,
  message: "If those details match a Match Fit Fitness Pro account, a reset link is on its way to the email on file.",
};

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter your username, email, and phone number." }, { status: 400 });
    }

    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }

    const match = await findTrainerForPasswordReset(parsed.data);
    if (!match) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const nonce = randomBytes(24).toString("hex");
    const token = await signPasswordChangeToken(match.id, nonce);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.trainer.update({
      where: { id: match.id },
      data: { passwordChangeNonce: nonce, passwordChangeExpires: expiresAt },
    });

    const origin = getAppOriginFromRequest(req);
    const resetUrl = `${origin}/trainer/reset-password?token=${encodeURIComponent(token)}`;
    await deliverPasswordResetEmail({ email: match.email, resetUrl });

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Something went wrong. Try again.", {
      logLabel: "[trainer forgot-password request]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
