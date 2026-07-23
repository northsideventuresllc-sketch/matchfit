import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeCoachLanguage } from "@/lib/content-calendar/content-rules";
import { archiveHubOutreachLeadOnAdminDelete } from "@/lib/outreach-archive";
import { softDeleteOutreachLead, updateOutreachLead } from "@/lib/outreach-data";
import { leadProfileForPlatform } from "@/lib/outreach-lead-profile";
import {
  recordOutreachDeadLeadSignal,
  recordOutreachDeleteReasonSignal,
  recordOutreachEditSignal,
  recordOutreachSavedToHubSignal,
} from "@/lib/outreach-learning";
import type { OutreachPlatform } from "@/lib/outreach-types";
import { resolveOutreachActor } from "@/lib/require-service-token";
import { prisma } from "@/lib/prisma";

import {
  FACEBOOK_STATUS_VALUES,
  INSTAGRAM_EMAIL_STATUS_VALUES,
  OUTREACH_PLATFORM_VALUES,
} from "@/lib/outreach-types";
import {
  isOutreachIntent,
  outreachSendRequiresIntent,
} from "@/lib/outreach-cowork";

type OutreachCopyFieldName =
  | "dmText"
  | "commentText"
  | "followUp1DmText"
  | "followUp2DmText"
  | "pagePostText"
  | "emailSubject"
  | "emailBody"
  | "followUp1EmailSubject"
  | "followUp1EmailBody"
  | "followUp2EmailSubject"
  | "followUp2EmailBody";

async function recordAndNormalizeCopyEdits(args: {
  platform: OutreachPlatform;
  leadId: string;
  adminId: string;
  existing: Record<string, unknown>;
  patch: Record<string, unknown>;
  fields: readonly OutreachCopyFieldName[];
}): Promise<void> {
  for (const field of args.fields) {
    const nextRaw = args.patch[field];
    if (typeof nextRaw !== "string") continue;
    const next = normalizeCoachLanguage(nextRaw);
    args.patch[field] = next;
    const prev = String(args.existing[field] ?? "");
    if (next === prev) continue;
    await recordOutreachEditSignal({
      platform: args.platform,
      leadId: args.leadId,
      adminId: args.adminId,
      field,
      originalText: prev,
      editedText: next,
    });
    args.patch[`${field}Edited`] = true;
  }
}

const patchSchema = z
  .object({
    platform: z.enum(OUTREACH_PLATFORM_VALUES),
    status: z.string().optional(),
    outreachIntent: z
      .union([z.enum(["LIST_WITH_US", "JOIN_AS_FP", "BOTH"]), z.null()])
      .optional(),
    dmText: z.string().max(8000).optional(),
    commentText: z.string().max(2000).optional(),
    followUp1DmText: z.string().max(8000).optional(),
    followUp2DmText: z.string().max(8000).optional(),
    pagePostText: z.string().max(8000).optional(),
    emailSubject: z.string().max(500).optional(),
    emailBody: z.string().max(8000).optional(),
    followUp1EmailSubject: z.string().max(500).optional(),
    followUp1EmailBody: z.string().max(8000).optional(),
    followUp2EmailSubject: z.string().max(500).optional(),
    followUp2EmailBody: z.string().max(8000).optional(),
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

/**
 * GET /api/admin/outreach/leads/[id]?platform=instagram|facebook|email
 *
 * Full lead detail for the AXON Telegram bridge to render an Approve/Delete/Rewrite
 * card. Dual-auth (service token OR admin cookie). Requires `platform` as a query param
 * since the id alone doesn't identify which platform table the lead lives in.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await resolveOutreachActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const platformParam = new URL(req.url).searchParams.get("platform");
  if (!platformParam || !(OUTREACH_PLATFORM_VALUES as readonly string[]).includes(platformParam)) {
    return NextResponse.json(
      { error: "Provide a valid platform query param (instagram, facebook, or email)." },
      { status: 400 },
    );
  }
  const platform = platformParam as OutreachPlatform;

  try {
    if (platform === "instagram") {
      const row = await prisma.outreachInstagramLead.findUnique({ where: { id } });
      if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
      return NextResponse.json({
        lead: {
          id: row.id,
          platform: "instagram" as const,
          handle: row.handle,
          profileUrl: row.profileUrl,
          niche: row.niche,
          targetGroup: row.targetGroup,
          whyMatchFit: row.whyMatchFit,
          likelihoodScore: row.likelihoodScore,
          notes: row.notes,
          outreachIntent: row.outreachIntent,
          status: row.status,
          dmText: row.dmText,
          commentText: row.commentText,
          followUp1DmText: row.followUp1DmText,
          followUp2DmText: row.followUp2DmText,
        },
      });
    }
    if (platform === "facebook") {
      const row = await prisma.outreachFacebookLead.findUnique({ where: { id } });
      if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
      return NextResponse.json({
        lead: {
          id: row.id,
          platform: "facebook" as const,
          pageName: row.pageName,
          pageUrl: row.pageUrl,
          audience: row.audience,
          niche: row.niche,
          targetGroup: row.targetGroup,
          whyMatchFit: row.whyMatchFit,
          likelihoodScore: row.likelihoodScore,
          notes: row.notes,
          outreachIntent: row.outreachIntent,
          status: row.status,
          pagePostText: row.pagePostText,
        },
      });
    }
    const row = await prisma.outreachEmailLead.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({
      lead: {
        id: row.id,
        platform: "email" as const,
        name: row.name,
        email: row.email,
        businessName: row.businessName,
        niche: row.niche,
        targetGroup: row.targetGroup,
        whyMatchFit: row.whyMatchFit,
        likelihoodScore: row.likelihoodScore,
        notes: row.notes,
        outreachIntent: row.outreachIntent,
        status: row.status,
        emailSubject: row.emailSubject,
        emailBody: row.emailBody,
        followUp1EmailSubject: row.followUp1EmailSubject,
        followUp1EmailBody: row.followUp1EmailBody,
        followUp2EmailSubject: row.followUp2EmailSubject,
        followUp2EmailBody: row.followUp2EmailBody,
      },
    });
  } catch (e) {
    console.error("[outreach lead GET]", e);
    return NextResponse.json({ error: "Could not load lead." }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await resolveOutreachActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

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
      const nextIntent =
        patch.outreachIntent === undefined ? existing.outreachIntent : patch.outreachIntent;
      if (
        outreachSendRequiresIntent(platform, patch.status) &&
        !isOutreachIntent(nextIntent)
      ) {
        return NextResponse.json(
          {
            error:
              "Set outreach intent (List With Us, Join as Fitness Pro, or Both) before marking outreach sent.",
          },
          { status: 400 },
        );
      }
      await recordAndNormalizeCopyEdits({
        platform: "instagram",
        leadId: id,
        adminId: actor.adminId,
        existing: existing as unknown as Record<string, unknown>,
        patch: patch as Record<string, unknown>,
        fields: ["dmText", "commentText", "followUp1DmText", "followUp2DmText"],
      });
      if (patch.status === "DEAD_LEAD" && existing.status !== "DEAD_LEAD") {
        await recordOutreachDeadLeadSignal({
          platform: "instagram",
          leadId: id,
          adminId: actor.adminId,
          profile: leadProfileForPlatform("instagram", { ...existing, status: "DEAD_LEAD" }),
        });
      }

      const updated = await updateOutreachLead(platform as OutreachPlatform, id, patch);
      if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
      if (patch.saveToHub === true && !existing.savedToHubAt) {
        await recordOutreachSavedToHubSignal({
          platform: "instagram",
          leadId: id,
          adminId: actor.adminId,
          profile: leadProfileForPlatform("instagram", existing),
        });
      }
      return NextResponse.json({ lead: updated });
    } else if (platform === "facebook") {
      const existing = await prisma.outreachFacebookLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      await recordAndNormalizeCopyEdits({
        platform: "facebook",
        leadId: id,
        adminId: actor.adminId,
        existing: existing as unknown as Record<string, unknown>,
        patch: patch as Record<string, unknown>,
        fields: ["pagePostText"],
      });
      if (patch.status === "DEAD_LEAD" && existing.status !== "DEAD_LEAD") {
        await recordOutreachDeadLeadSignal({
          platform: "facebook",
          leadId: id,
          adminId: actor.adminId,
          profile: leadProfileForPlatform("facebook", { ...existing, status: "DEAD_LEAD" }),
        });
      }

      const updated = await updateOutreachLead(platform as OutreachPlatform, id, patch);
      if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
      if (patch.saveToHub === true && !existing.savedToHubAt) {
        await recordOutreachSavedToHubSignal({
          platform: "facebook",
          leadId: id,
          adminId: actor.adminId,
          profile: leadProfileForPlatform("facebook", existing),
        });
      }
      return NextResponse.json({ lead: updated });
    } else if (platform === "email") {
      const existing = await prisma.outreachEmailLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      const nextIntent =
        patch.outreachIntent === undefined ? existing.outreachIntent : patch.outreachIntent;
      if (
        outreachSendRequiresIntent(platform, patch.status) &&
        !isOutreachIntent(nextIntent)
      ) {
        return NextResponse.json(
          {
            error:
              "Set outreach intent (List With Us, Join as Fitness Pro, or Both) before marking outreach sent.",
          },
          { status: 400 },
        );
      }
      await recordAndNormalizeCopyEdits({
        platform: "email",
        leadId: id,
        adminId: actor.adminId,
        existing: existing as unknown as Record<string, unknown>,
        patch: patch as Record<string, unknown>,
        fields: [
          "emailSubject",
          "emailBody",
          "followUp1EmailSubject",
          "followUp1EmailBody",
          "followUp2EmailSubject",
          "followUp2EmailBody",
        ],
      });
      if (patch.status === "DEAD_LEAD" && existing.status !== "DEAD_LEAD") {
        await recordOutreachDeadLeadSignal({
          platform: "email",
          leadId: id,
          adminId: actor.adminId,
          profile: leadProfileForPlatform("email", { ...existing, status: "DEAD_LEAD" }),
        });
      }

      const updated = await updateOutreachLead(platform as OutreachPlatform, id, patch);
      if (!updated) return NextResponse.json({ error: "Not found." }, { status: 404 });
      if (patch.saveToHub === true && !existing.savedToHubAt) {
        await recordOutreachSavedToHubSignal({
          platform: "email",
          leadId: id,
          adminId: actor.adminId,
          profile: leadProfileForPlatform("email", existing),
        });
      }
      return NextResponse.json({ lead: updated });
    }

    return NextResponse.json({ error: "Unsupported platform." }, { status: 400 });
  } catch (e) {
    console.error("[outreach lead PATCH]", e);
    return NextResponse.json({ error: "Could not update lead." }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await resolveOutreachActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

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
    let savedToHub = false;

    if (platform === "instagram") {
      const existing = await prisma.outreachInstagramLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      savedToHub = Boolean(existing.savedToHubAt);
      await recordOutreachDeleteReasonSignal({
        platform: "instagram",
        leadId: id,
        adminId: actor.adminId,
        reason: deleteReason,
        profile: leadProfileForPlatform("instagram", existing),
      });
      if (savedToHub) {
        await recordOutreachDeadLeadSignal({
          platform: "instagram",
          leadId: id,
          adminId: actor.adminId,
          profile: leadProfileForPlatform("instagram", { ...existing, status: "DEAD_LEAD" }),
        });
      }
    } else if (platform === "facebook") {
      const existing = await prisma.outreachFacebookLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      savedToHub = Boolean(existing.savedToHubAt);
      await recordOutreachDeleteReasonSignal({
        platform: "facebook",
        leadId: id,
        adminId: actor.adminId,
        reason: deleteReason,
        profile: leadProfileForPlatform("facebook", existing),
      });
      if (savedToHub) {
        await recordOutreachDeadLeadSignal({
          platform: "facebook",
          leadId: id,
          adminId: actor.adminId,
          profile: leadProfileForPlatform("facebook", { ...existing, status: "DEAD_LEAD" }),
        });
      }
    } else if (platform === "email") {
      const existing = await prisma.outreachEmailLead.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
      savedToHub = Boolean(existing.savedToHubAt);
      await recordOutreachDeleteReasonSignal({
        platform: "email",
        leadId: id,
        adminId: actor.adminId,
        reason: deleteReason,
        profile: leadProfileForPlatform("email", existing),
      });
      if (savedToHub) {
        await recordOutreachDeadLeadSignal({
          platform: "email",
          leadId: id,
          adminId: actor.adminId,
          profile: leadProfileForPlatform("email", { ...existing, status: "DEAD_LEAD" }),
        });
      }
    }

    if (savedToHub) {
      const archived = await archiveHubOutreachLeadOnAdminDelete(platform as OutreachPlatform, id);
      if (!archived) {
        return NextResponse.json({ error: "Could not archive hub lead." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, archived: true });
    }

    await softDeleteOutreachLead(platform as OutreachPlatform, id);
    return NextResponse.json({ ok: true, archived: false });
  } catch (e) {
    console.error("[outreach lead DELETE]", e);
    return NextResponse.json({ error: "Could not delete lead." }, { status: 500 });
  }
}
