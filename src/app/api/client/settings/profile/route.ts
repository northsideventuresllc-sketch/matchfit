import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { firstZodErrorMessage, settingsProfilePatchSchema } from "@/lib/validations/client-settings-profile";
import { NextResponse } from "next/server";

const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function blankToNull(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function nextUsernameChangeAt(changedAt: Date | null): string | null {
  if (!changedAt) return null;
  return new Date(changedAt.getTime() + USERNAME_COOLDOWN_MS).toISOString();
}

export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        firstName: true,
        lastName: true,
        preferredName: true,
        bio: true,
        profileImageUrl: true,
        email: true,
        phone: true,
        username: true,
        usernameChangedAt: true,
        pendingEmail: true,
        pendingPhone: true,
        addressLine1: true,
        addressLine2: true,
        addressCity: true,
        addressState: true,
        addressPostal: true,
        addressCountry: true,
      },
    });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({
      profile: {
        ...client,
        nextUsernameChangeAt: nextUsernameChangeAt(client.usernameChangedAt),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load profile." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = settingsProfilePatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const data: Record<string, unknown> = {};

    if (body.firstName !== undefined) data.firstName = body.firstName;
    if (body.lastName !== undefined) data.lastName = body.lastName;
    if (body.preferredName !== undefined) data.preferredName = body.preferredName;
    if (body.bio !== undefined) data.bio = blankToNull(body.bio) ?? null;

    const addrKeys = [
      "addressLine1",
      "addressLine2",
      "addressCity",
      "addressState",
      "addressPostal",
      "addressCountry",
    ] as const;
    for (const k of addrKeys) {
      if (body[k] !== undefined) {
        data[k] = blankToNull(body[k]) ?? null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes provided." }, { status: 400 });
    }

    const updated = await prisma.client.update({
      where: { id: clientId },
      data,
      select: {
        firstName: true,
        lastName: true,
        preferredName: true,
        bio: true,
        profileImageUrl: true,
        email: true,
        phone: true,
        username: true,
        usernameChangedAt: true,
        pendingEmail: true,
        pendingPhone: true,
        addressLine1: true,
        addressLine2: true,
        addressCity: true,
        addressState: true,
        addressPostal: true,
        addressCountry: true,
      },
    });

    return NextResponse.json({
      profile: {
        ...updated,
        nextUsernameChangeAt: nextUsernameChangeAt(updated.usernameChangedAt),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update profile." }, { status: 500 });
  }
}
