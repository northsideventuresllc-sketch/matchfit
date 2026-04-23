import { isEmailTakenByAnother } from "@/lib/client-queries";
import { verifyEmailChangeToken } from "@/lib/email-change-jwt";
import { prisma } from "@/lib/prisma";
import { firstZodErrorMessage, settingsEmailChangeCompleteSchema } from "@/lib/validations/client-settings-profile";
import { NextResponse } from "next/server";

const CLEAR_EMAIL_CHANGE = {
  pendingEmail: null,
  emailChangeNonce: null,
  emailChangeExpires: null,
} as const;

export async function POST(req: Request) {
  try {
    const parsed = settingsEmailChangeCompleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const claims = await verifyEmailChangeToken(parsed.data.token);
    if (!claims) {
      return NextResponse.json({ error: "This confirmation link is invalid or has expired." }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id: claims.clientId } });
    if (
      !client?.emailChangeNonce ||
      !client.emailChangeExpires ||
      !client.pendingEmail ||
      client.emailChangeNonce !== claims.nonce ||
      client.pendingEmail !== claims.newEmail
    ) {
      return NextResponse.json(
        { error: "This confirmation link is no longer valid. Start again from account settings." },
        { status: 400 },
      );
    }
    if (client.emailChangeExpires < new Date()) {
      return NextResponse.json({ error: "This link has expired. Request a new email change from settings." }, {
        status: 400,
      });
    }

    if (await isEmailTakenByAnother(claims.newEmail, client.id)) {
      await prisma.client.update({
        where: { id: client.id },
        data: { ...CLEAR_EMAIL_CHANGE },
      });
      return NextResponse.json(
        { error: "That email address was taken by another account. Your email was not changed." },
        { status: 409 },
      );
    }

    await prisma.client.update({
      where: { id: client.id },
      data: {
        email: claims.newEmail,
        ...CLEAR_EMAIL_CHANGE,
      },
    });

    return NextResponse.json({ ok: true, email: claims.newEmail });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not confirm email change." }, { status: 500 });
  }
}
