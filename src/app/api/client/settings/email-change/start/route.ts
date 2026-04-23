import { randomBytes } from "crypto";
import { isEmailTakenByAnother } from "@/lib/client-queries";
import { deliverEmailChangeConfirmation, deliverEmailChangeSecurityNotice } from "@/lib/deliver-email-change";
import { signEmailChangeToken } from "@/lib/email-change-jwt";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { getSessionClientId } from "@/lib/session";
import { firstZodErrorMessage, settingsEmailChangeStartSchema } from "@/lib/validations/client-settings-profile";
import { NextResponse } from "next/server";

const RESEND_MIN_MS = 90_000;

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = settingsEmailChangeStartSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const { newEmail, currentPassword } = parsed.data;
    const normalized = newEmail.trim().toLowerCase();

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const pwOk = await verifyPassword(currentPassword, client.passwordHash);
    if (!pwOk) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    if (normalized === client.email.toLowerCase()) {
      return NextResponse.json({ error: "That is already your email address." }, { status: 400 });
    }

    if (client.lastEmailChangeRequest) {
      const elapsed = Date.now() - client.lastEmailChangeRequest.getTime();
      if (elapsed < RESEND_MIN_MS) {
        return NextResponse.json(
          { error: "Please wait a minute before requesting another email change." },
          { status: 429 },
        );
      }
    }

    if (await isEmailTakenByAnother(normalized, clientId)) {
      return NextResponse.json({ error: "That email address is already in use." }, { status: 400 });
    }

    const nonce = randomBytes(24).toString("hex");
    const token = await signEmailChangeToken(clientId, nonce, normalized);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.client.update({
      where: { id: clientId },
      data: {
        pendingEmail: normalized,
        emailChangeNonce: nonce,
        emailChangeExpires: expiresAt,
        lastEmailChangeRequest: new Date(),
      },
    });

    const origin = getAppOriginFromRequest(req);
    const confirmUrl = `${origin}/client/settings/confirm-email-change?token=${encodeURIComponent(token)}`;

    await deliverEmailChangeConfirmation({ toEmail: normalized, confirmUrl });
    await deliverEmailChangeSecurityNotice({ toEmail: client.email, newEmail: normalized });

    return NextResponse.json({ ok: true, pendingEmail: normalized });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Could not start email change.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
