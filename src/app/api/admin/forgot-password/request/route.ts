import { randomBytes } from "crypto";
import { findAdminForPasswordReset } from "@/lib/forgot-password-verify";
import { deliverPasswordResetEmail } from "@/lib/deliver-password-reset-email";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { normalizeAdministratorCodeInput } from "@/lib/admin-code";
import { signPasswordChangeToken } from "@/lib/password-change-jwt";
import { prisma } from "@/lib/prisma";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { verifyTurnstileToken } from "@/lib/turnstile-verify";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  adminCode: z.string().trim().min(1),
  email: z.string().trim().email(),
  dateOfBirth: z.string().trim().min(1),
  turnstileToken: z.string().optional(),
});

/**
 * Requires the FULL combination of administrator code + email + date of birth to match the
 * same admin account — any one field wrong sends nothing (JB, 2026-08-05). Response is
 * identical whether or not an account matched.
 */
const GENERIC_RESPONSE = {
  ok: true,
  message: "If those details match an administrator account, a reset link is on its way to the email on file.",
};

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter your administrator code, email, and date of birth." }, { status: 400 });
    }

    const turn = await verifyTurnstileToken(parsed.data.turnstileToken, req);
    if (!turn.ok) {
      return NextResponse.json({ error: turn.error }, { status: turn.status });
    }

    const match = await findAdminForPasswordReset({
      ...parsed.data,
      adminCode: normalizeAdministratorCodeInput(parsed.data.adminCode),
    });
    if (!match) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const nonce = randomBytes(24).toString("hex");
    const token = await signPasswordChangeToken(match.id, nonce);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.administrator.update({
      where: { id: match.id },
      data: { passwordChangeNonce: nonce, passwordChangeExpires: expiresAt },
    });

    const origin = getAppOriginFromRequest(req);
    const resetUrl = `${origin}/admin/reset-password?token=${encodeURIComponent(token)}`;
    await deliverPasswordResetEmail({ email: match.email, resetUrl });

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Something went wrong. Try again.", {
      logLabel: "[admin forgot-password request]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
