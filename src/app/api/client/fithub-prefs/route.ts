import {
  clientFithubPrefsSchema,
  parseClientFithubPrefsJson,
  serializeClientFithubPrefs,
} from "@/lib/client-fithub-prefs";
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
      select: { fitHubPrefsJson: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({
      preferences: parseClientFithubPrefsJson(client.fitHubPrefsJson),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load FitHub settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const json = await req.json();
    const parsed = clientFithubPrefsSchema.safeParse(json?.preferences ?? json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid preferences." }, { status: 400 });
    }
    await prisma.client.update({
      where: { id: clientId },
      data: { fitHubPrefsJson: serializeClientFithubPrefs(parsed.data) },
    });
    return NextResponse.json({ preferences: parsed.data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not save FitHub settings." }, { status: 500 });
  }
}
