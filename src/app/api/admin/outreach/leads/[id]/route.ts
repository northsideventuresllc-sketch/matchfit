import { NextResponse } from "next/server";
import { z } from "zod";
import { softDeleteOutreachLead, updateOutreachLead } from "@/lib/outreach-data";
import { recordOutreachEditSignal } from "@/lib/outreach-learning";
import type { OutreachPlatform } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";

import {
  FACEBOOK_STATUS_VALUES,
  INSTAGRAM_EMAIL_STATUS_VALUES,
  OUTREACH_PLATFORM_VALUES,
} from "@/lib/outreach-types";

const patchSchema = z
  .object({
    platform: z.enum(OUTREACH_PLATFORM_VALUES),
    status: z.string().optional(),
    dmText: z.string().max(8000).optional(),
    commentText: z.string().max(2000).optional(),
    pagePostText: z.string().max(8000).optional(),
    emailSubject: z.string().max(500).optional(),
    emailBody: z.string().max(8000).optional(),
    saveToHub: z.literal(true).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.status) return;
    const allowed =
      data.platform === "facebook" ? FACEBOOK_STATUS_VALUES : INSTAGRAM_EMAIL_STATUS_VALUES;
    if (!(allowed as readonly string[]).includes(data.status)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid status for platform.", path: ["status"] });
    }
  });

const deleteSchema = z.object({
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { platform, ...patch } = parsed.data;

  try {
    if (platform === "instagram") {
      const existing = await prisma.outreachInstagramLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      if (patch.dmText && patch.dmText !== existing.dmText) {
        await recordOutreachEditSignal({
          platform: "instagram",
          leadId: id,
          field: "dmText",
          originalText: existing.dmText,
          editedText: patch.dmText,
        });
        (patch as Record<string, unknown>).dmTextEdited = true;
      }
      if (patch.commentText && patch.commentText !== existing.commentText) {
        await recordOutreachEditSignal({
          platform: "instagram",
          leadId: id,
          field: "commentText",
          originalText: existing.commentText,
          editedText: patch.commentText,
        });
        (patch as Record<string, unknown>).commentTextEdited = true;
      }
    } else if (platform === "facebook") {
      const existing = await prisma.outreachFacebookLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      if (patch.pagePostText && patch.pagePostText !== existing.pagePostText) {
        await recordOutreachEditSignal({
          platform: "facebook",
          leadId: id,
          field: "pagePostText",
          originalText: existing.pagePostText,
          editedText: patch.pagePostText,
        });
        (patch as Record<string, unknown>).pagePostTextEdited = true;
      }
    } else if (platform === "email") {
      const existing = await prisma.outreachEmailLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      if (patch.emailBody && patch.emailBody !== existing.emailBody) {
        await recordOutreachEditSignal({
          platform: "email",
          leadId: id,
          field: "emailBody",
          originalText: existing.emailBody,
          editedText: patch.emailBody,
        });
        (patch as Record<string, unknown>).emailBodyEdited = true;
      }
    }

    const updated = await updateOutreachLead(platform as OutreachPlatform, id, patch);
    if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ lead: updated });
  } catch (e) {
    console.error("[outreach lead PATCH]", e);
    return NextResponse.json({ error: "Could not update lead." }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    await softDeleteOutreachLead(parsed.data.platform as OutreachPlatform, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[outreach lead DELETE]", e);
    return NextResponse.json({ error: "Could not delete lead." }, { status: 500 });
  }
}
