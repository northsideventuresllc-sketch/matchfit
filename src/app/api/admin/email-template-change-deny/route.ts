import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailTemplateChangeDeniedNotice } from "@/lib/admin-email-template-change-email";
import { verifyEmailTemplateChangeDenyFeedbackToken } from "@/lib/email-template-change-token";
import type { TransactionalEmailKind } from "@/lib/transactional-email-kinds";
import { ensureEmailTemplateSchema } from "@/lib/ensure-email-template-schema";

export async function POST(req: Request) {
  let body: { token?: string; reviewNotes?: string };
  try {
    body = (await req.json()) as { token?: string; reviewNotes?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const token = body.token?.trim();
  const reviewNotes = body.reviewNotes?.trim();
  if (!token) return NextResponse.json({ error: "token required." }, { status: 400 });
  if (!reviewNotes || reviewNotes.length < 4) {
    return NextResponse.json({ error: "Please describe what needs to be adjusted." }, { status: 400 });
  }

  const verified = await verifyEmailTemplateChangeDenyFeedbackToken(token);
  if (!verified) return NextResponse.json({ error: "Invalid or expired link." }, { status: 400 });

  await ensureEmailTemplateSchema();

  const pending = await prisma.pendingTransactionalEmailTemplateChange.findUnique({
    where: { id: verified.pendingId },
    include: {
      requestedByAdmin: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  if (!pending) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (pending.status !== "PENDING") {
    return NextResponse.json({ error: "This request was already handled." }, { status: 409 });
  }

  await prisma.pendingTransactionalEmailTemplateChange.update({
    where: { id: pending.id },
    data: { status: "DENIED", reviewNotes, reviewedAt: new Date() },
  });

  if (pending.requestedByAdmin?.email) {
    await sendEmailTemplateChangeDeniedNotice({
      to: pending.requestedByAdmin.email,
      kind: pending.kind as TransactionalEmailKind,
      reviewNotes,
      requesterName: `${pending.requestedByAdmin.firstName} ${pending.requestedByAdmin.lastName}`.trim(),
    }).catch((e) => console.error("[email-template-change deny notice]", e));
  }

  return NextResponse.json({ ok: true });
}
