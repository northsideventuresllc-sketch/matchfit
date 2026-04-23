import { isUsernameTakenByAnother } from "@/lib/client-queries";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { getSessionClientId } from "@/lib/session";
import { firstZodErrorMessage, settingsUsernameSchema } from "@/lib/validations/client-settings-profile";
import { NextResponse } from "next/server";

const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = settingsUsernameSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const { username, currentPassword } = parsed.data;

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const pwOk = await verifyPassword(currentPassword, client.passwordHash);
    if (!pwOk) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    if (username === client.username) {
      return NextResponse.json({ error: "That is already your username." }, { status: 400 });
    }

    if (client.usernameChangedAt) {
      const nextAllowed = client.usernameChangedAt.getTime() + USERNAME_COOLDOWN_MS;
      if (Date.now() < nextAllowed) {
        return NextResponse.json(
          {
            error: "You can change your username at most once every 7 days.",
            nextUsernameChangeAt: new Date(nextAllowed).toISOString(),
          },
          { status: 429 },
        );
      }
    }

    if (await isUsernameTakenByAnother(username, clientId)) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 400 });
    }

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: { username, usernameChangedAt: new Date() },
      select: {
        username: true,
        usernameChangedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      username: updated.username,
      nextUsernameChangeAt: new Date(updated.usernameChangedAt!.getTime() + USERNAME_COOLDOWN_MS).toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update username." }, { status: 500 });
  }
}
