import { NextResponse } from "next/server";
import { z } from "zod";
import { softDeleteOutreachLead, updateOutreachLead } from "@/lib/outreach-data";
import { leadProfileForPlatform } from "@/lib/outreach-lead-profile";
import {
  recordOutreachDeadLeadSignal,
  recordOutreachDeleteReasonSignal,
  recordOutreachEditSignal,
  recordOutreachSavedToHubSignal,
} from "@/lib/outreach-learning";
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
  deleteReason: z.string().trim().min(3).max(2000),
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
          adminId: sess.adminId,
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
          adminId: sess.adminId,
          field: "commentText",
          originalText: existing.commentText,
          editedText: patch.commentText,
        });
        (patch as Record<string, unknown>).commentTextEdited = true;
      }
      if (patch.saveToHub === true && !existing.savedToHubAt) {
        await recordOutreachSavedToHubSignal({
          platform: "instagram",
          leadId: id,
          adminId: sess.adminId,
          profile: leadProfileForPlatform("instagram", existing),
        });
      }
      if (patch.status === "DEAD_LEAD" && existing.status !== "DEAD_LEAD") {
        await recordOutreachDeadLeadSignal({
          platform: "instagram",
          leadId: id,
          adminId: sess.adminId,
          profile: leadProfileForPlatform("instagram", { ...existing, status: "DEAD_LEAD" }),
        });
      }
    } else if (platform === "facebook") {
      const existing = await prisma.outreachFacebookLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      if (patch.pagePostText && patch.pagePostText !== existing.pagePostText) {
        await recordOutreachEditSignal({
          platform: "facebook",
          leadId: id,
          adminId: sess.adminId,
          field: "pagePostText",
          originalText: existing.pagePostText,
          editedText: patch.pagePostText,
        });
        (patch as Record<string, unknown>).pagePostTextEdited = true;
      }
      if (patch.saveToHub === true && !existing.savedToHubAt) {
        await recordOutreachSavedToHubSignal({
          platform: "facebook",
          leadId: id,
          adminId: sess.adminId,
          profile: leadProfileForPlatform("facebook", existing),
        });
      }
      if (patch.status === "DEAD_LEAD" && existing.status !== "DEAD_LEAD") {
        await recordOutreachDeadLeadSignal({
          platform: "facebook",
          leadId: id,
          adminId: sess.adminId,
          profile: leadProfileForPlatform("facebook", { ...existing, status: "DEAD_LEAD" }),
        });
      }
    } else if (platform === "email") {
      const existing = await prisma.outreachEmailLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      if (patch.emailBody && patch.emailBody !== existing.emailBody) {
        await recordOutreachEditSignal({
          platform: "email",
          leadId: id,
          adminId: sess.adminId,
          field: "emailBody",
          originalText: existing.emailBody,
          editedText: patch.emailBody,
        });
        (patch as Record<string, unknown>).emailBodyEdited = true;
      }
      if (patch.saveToHub === true && !existing.savedToHubAt) {
        await recordOutreachSavedToHubSignal({
          platform: "email",
          leadId: id,
          adminId: sess.adminId,
          profile: leadProfileForPlatform("email", existing),
        });
      }
      if (patch.status === "DEAD_LEAD" && existing.status !== "DEAD_LEAD") {
        await recordOutreachDeadLeadSignal({
          platform: "email",
          leadId: id,
          adminId: sess.adminId,
          profile: leadProfileForPlatform("email", { ...existing, status: "DEAD_LEAD" }),
        });
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
    return NextResponse.json(
      { error: "Please provide a reason why this lead was deleted (at least 3 characters)." },
      { status: 400 },
    );
  }

  const { platform, deleteReason } = parsed.data;

  try {
    if (platform === "instagram") {
      const existing = await prisma.outreachInstagramLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      await recordOutreachDeleteReasonSignal({
        platform: "instagram",
        leadId: id,
        adminId: sess.adminId,
        reason: deleteReason,
        profile: leadProfileForPlatform("instagram", existing),
      });
    } else if (platform === "facebook") {
      const existing = await prisma.outreachFacebookLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      await recordOutreachDeleteReasonSignal({
        platform: "facebook",
        leadId: id,
        adminId: sess.adminId,
        reason: deleteReason,
        profile: leadProfileForPlatform("facebook", existing),
      });
    } else if (platform === "email") {
      const existing = await prisma.outreachEmailLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      await recordOutreachDeleteReasonSignal({
        platform: "email",
        leadId: id,
        adminId: sess.adminId,
        reason: deleteReason,
        profile: leadProfileForPlatform("email", existing),
      });
    }

    await softDeleteOutreachLead(platform as OutreachPlatform, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[outreach lead DELETE]", e);
    return NextResponse.json({ error: "Could not delete lead." }, { status: 500 });
  }
}
