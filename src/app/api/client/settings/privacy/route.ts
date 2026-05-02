import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import {
  parseClientOptionalProfileVisibility,
  serializeClientOptionalProfileVisibility,
  type ClientOptionalProfileVisibility,
} from "@/lib/optional-profile-visibility";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { listBlocksInitiatedByClient } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  showBioOnPublicProfile: z.boolean().optional(),
  showMatchSnapshotOnPublicProfile: z.boolean().optional(),
});

export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { optionalProfileVisibilityJson: true, privacyPolicyAcceptedAt: true, deidentifiedAt: true },
    });
    if (!client || client.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const blockedProfiles = (await listBlocksInitiatedByClient(clientId)).map((b) => ({
      id: b.id,
      username: b.targetUsername,
      displayName: b.targetDisplayName,
      kind: "trainer" as const,
      hideTrainerFromClientMatchFeed: b.hideTrainerFromClientMatchFeed,
      hideTrainerFromClientFithub: b.hideTrainerFromClientFithub,
      blockDirectChat: b.blockDirectChat,
    }));

    return NextResponse.json({
      visibility: parseClientOptionalProfileVisibility(client.optionalProfileVisibilityJson),
      privacyPolicyAcceptedAt: client.privacyPolicyAcceptedAt?.toISOString() ?? null,
      blockedProfiles,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load privacy settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const body = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const cur = await prisma.client.findUnique({
      where: { id: clientId },
      select: { optionalProfileVisibilityJson: true, deidentifiedAt: true },
    });
    if (!cur || cur.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const merged: ClientOptionalProfileVisibility = {
      ...parseClientOptionalProfileVisibility(cur.optionalProfileVisibilityJson),
      ...body.data,
    };
    await prisma.client.update({
      where: { id: clientId },
      data: {
        optionalProfileVisibilityJson: serializeClientOptionalProfileVisibility(merged, cur.optionalProfileVisibilityJson),
      },
    });
    return NextResponse.json({ ok: true, visibility: merged });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not update privacy settings.", {
      logLabel: "[client settings privacy]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
