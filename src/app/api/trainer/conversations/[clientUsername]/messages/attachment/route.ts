import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { runOutboundChatComplianceMonitoring } from "@/lib/chat-compliance-monitor";
import {
  assertChatAttachmentMime,
  type ChatAttachmentPayload,
  sanitizeChatAttachmentFilename,
  serializeChatAttachmentPayload,
} from "@/lib/chat-attachment";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { canAuthorSendChatMessage } from "@/lib/trainer-client-chat-rules";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { isTrainerClientChatBlocked } from "@/lib/user-block-queries";
import { NextResponse } from "next/server";

const MAX_BODY = 4000;

type RouteContext = { params: Promise<{ clientUsername: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        profile: {
          select: {
            dashboardActivatedAt: true,
            hasSignedTOS: true,
            hasUploadedW9: true,
            backgroundCheckStatus: true,
            backgroundCheckClearedAt: true,
            onboardingTrackCpt: true,
            onboardingTrackNutrition: true,
            onboardingTrackSpecialist: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
          },
        },
      },
    });
    if (!trainer?.profile || trainer.profile.dashboardActivatedAt == null || !isTrainerComplianceComplete(trainer.profile)) {
      return NextResponse.json({ error: "Your trainer profile must be live." }, { status: 403 });
    }

    const { clientUsername } = await ctx.params;
    const handle = decodeURIComponent(clientUsername).trim();
    const client = await prisma.client.findUnique({
      where: { username: handle },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    if (await isTrainerClientChatBlocked(trainerId, client.id)) {
      return NextResponse.json({ error: "Messaging is blocked for this thread." }, { status: 403 });
    }

    const conv = await prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId, clientId: client.id } },
    });
    if (conv?.archivedAt) {
      return NextResponse.json({ error: "This chat is archived. Revive it if you are the person who archived it." }, { status: 403 });
    }
    if (!conv?.officialChatStartedAt) {
      return NextResponse.json(
        {
          error:
            "This chat is not open yet. Accept the client’s inquiry (or wait for them to respond to your nudge).",
        },
        { status: 403 },
      );
    }

    const prior = await prisma.trainerClientChatMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "asc" },
      select: { authorRole: true },
    });
    const gate = canAuthorSendChatMessage(prior, "TRAINER");
    if (!gate.ok) {
      return NextResponse.json({ error: gate.reason }, { status: 429 });
    }

    const form = await req.formData();
    const fileRaw = form.get("file");
    const captionRaw = form.get("caption");
    const caption = typeof captionRaw === "string" ? captionRaw.trim().slice(0, MAX_BODY) : "";

    if (!fileRaw || !(fileRaw instanceof Blob)) {
      return NextResponse.json({ error: "Choose a file to attach." }, { status: 400 });
    }

    let ext: string;
    let mimeType: string;
    try {
      ({ ext, mimeType } = assertChatAttachmentMime(fileRaw));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid file.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const origName = sanitizeChatAttachmentFilename(fileRaw instanceof File ? fileRaw.name : "attachment");

    const storeId = randomUUID();
    const relDir = path.join("public", "uploads", "chat-attachments", conv.id);
    const fileNameOnDisk = `${storeId}.${ext}`;
    const relativeUrl = `/uploads/chat-attachments/${conv.id}/${fileNameOnDisk}`;
    const outPath = path.join(process.cwd(), relDir, fileNameOnDisk);

    const buf = Buffer.from(await fileRaw.arrayBuffer());

    await mkdir(path.join(process.cwd(), relDir), { recursive: true });
    await writeFile(outPath, buf);

    const syntheticBody = !caption;
    const finalBody = (caption || `[File] ${origName}`).slice(0, MAX_BODY);

    await runOutboundChatComplianceMonitoring({
      conversationId: conv.id,
      authorRole: "TRAINER",
      body: caption || `[Trainer shared attachment: ${origName}]`,
    });

    const attachmentPayload: ChatAttachmentPayload = {
      url: relativeUrl,
      filename: origName,
      mimeType,
      sizeBytes: fileRaw.size,
    };
    if (syntheticBody) attachmentPayload.syntheticBody = true;

    const msg = await prisma.trainerClientChatMessage.create({
      data: {
        conversationId: conv.id,
        authorRole: "TRAINER",
        body: finalBody,
        attachmentJson: serializeChatAttachmentPayload(attachmentPayload),
      },
    });
    await prisma.trainerClientConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      message: {
        id: msg.id,
        authorRole: msg.authorRole,
        body: msg.body,
        createdAt: msg.createdAt.toISOString(),
        attachment: attachmentPayload,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not upload attachment." }, { status: 500 });
  }
}
