import {
  clientMatchPreferencesSchema,
  parseClientMatchPreferencesJson,
  serializeClientMatchPreferences,
} from "@/lib/client-match-preferences";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        matchPreferencesJson: true,
        matchPreferencesCompletedAt: true,
        allowTrainerDiscovery: true,
      },
    });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const preferences = parseClientMatchPreferencesJson(client.matchPreferencesJson);
    return NextResponse.json({
      preferences,
      matchPreferencesCompletedAt: client.matchPreferencesCompletedAt?.toISOString() ?? null,
      allowTrainerDiscovery: client.allowTrainerDiscovery,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load preferences." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const body = (await req.json()) as {
      preferences?: unknown;
      allowTrainerDiscovery?: boolean;
      markComplete?: boolean;
    };

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const data: {
      matchPreferencesJson?: string;
      matchPreferencesCompletedAt?: Date | null;
      allowTrainerDiscovery?: boolean;
    } = {};

    if (body.preferences !== undefined) {
      const parsed = clientMatchPreferencesSchema.safeParse(body.preferences);
      if (!parsed.success) {
        const msg = parsed.error.flatten().fieldErrors;
        const first = Object.values(msg).flat()[0] ?? "Invalid preferences.";
        return NextResponse.json({ error: first }, { status: 400 });
      }
      data.matchPreferencesJson = serializeClientMatchPreferences(parsed.data);
    }

    if (typeof body.allowTrainerDiscovery === "boolean") {
      data.allowTrainerDiscovery = body.allowTrainerDiscovery;
    }

    if (body.markComplete === true) {
      const prefs = parseClientMatchPreferencesJson(
        data.matchPreferencesJson ?? client.matchPreferencesJson ?? undefined,
      );
      const check = clientMatchPreferencesSchema.safeParse(prefs);
      if (!check.success) {
        const msg = check.error.flatten().fieldErrors;
        const first = Object.values(msg).flat()[0] ?? "Complete all required fields.";
        return NextResponse.json({ error: first }, { status: 400 });
      }
      data.matchPreferencesJson = serializeClientMatchPreferences(check.data);
      data.matchPreferencesCompletedAt = new Date();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes provided." }, { status: 400 });
    }

    const updated = await prisma.client.update({
      where: { id: clientId },
      data,
      select: {
        matchPreferencesJson: true,
        matchPreferencesCompletedAt: true,
        allowTrainerDiscovery: true,
      },
    });

    const preferences = parseClientMatchPreferencesJson(updated.matchPreferencesJson);
    return NextResponse.json({
      preferences,
      matchPreferencesCompletedAt: updated.matchPreferencesCompletedAt?.toISOString() ?? null,
      allowTrainerDiscovery: updated.allowTrainerDiscovery,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save preferences." }, { status: 500 });
  }
}
