import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";

const campaignPlatformSchema = z.enum(["google", "meta", "tiktok"]);

const postSchema = z.object({
  campaignId: z.string().min(1).max(128),
  platform: campaignPlatformSchema,
  name: z.string().min(1).max(200),
  venture: z.string().min(1).max(64),
  budgetCents: z.number().int().nonnegative().optional(),
  weekOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().max(2000).optional(),
});

function serializeCampaign(row: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  campaignId: string;
  platform: string;
  name: string;
  venture: string;
  budgetCents: number | null;
  weekOf: string | null;
  notes: string | null;
}) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const campaigns = await prisma.adCampaignRegistry.findMany({
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return NextResponse.json({
      campaigns: campaigns.map(serializeCampaign),
    });
  } catch (e) {
    if (isPrismaMissingTableError(e, "ad_campaign_registry")) {
      return NextResponse.json({ campaigns: [], migrationPending: true });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign." }, { status: 400 });
  }

  try {
    const campaign = await prisma.adCampaignRegistry.create({
      data: {
        campaignId: parsed.data.campaignId.trim(),
        platform: parsed.data.platform,
        name: parsed.data.name.trim(),
        venture: parsed.data.venture.trim(),
        budgetCents: parsed.data.budgetCents,
        weekOf: parsed.data.weekOf,
        notes: parsed.data.notes?.trim() || undefined,
      },
    });
    return NextResponse.json({ campaign: serializeCampaign(campaign) });
  } catch (e) {
    if (isPrismaMissingTableError(e, "ad_campaign_registry")) {
      return NextResponse.json(
        { error: "Campaign registry table not migrated yet. Run prisma migrate deploy." },
        { status: 503 },
      );
    }
    throw e;
  }
}
