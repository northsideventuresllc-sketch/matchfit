import {
  clientNotificationPrefsSchema,
  parseClientNotificationPrefsJson,
  serializeClientNotificationPrefs,
} from "@/lib/client-notification-prefs";
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
      select: { notificationPrefsJson: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({
      preferences: parseClientNotificationPrefsJson(client.notificationPrefsJson),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load notification settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const json = await req.json();
    const parsed = clientNotificationPrefsSchema.safeParse(json?.preferences ?? json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid preferences." }, { status: 400 });
    }
    await prisma.client.update({
      where: { id: clientId },
      data: { notificationPrefsJson: serializeClientNotificationPrefs(parsed.data) },
    });
    return NextResponse.json({ preferences: parsed.data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save notification settings." }, { status: 500 });
  }
}
