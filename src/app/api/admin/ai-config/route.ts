import { NextResponse } from "next/server";
import { z } from "zod";
import { clearPlatformSecretCache } from "@/lib/platform-secrets";
import { requireAdminSession } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  anthropicApiKey: z.string().startsWith("sk-ant-"),
  anthropicModel: z.string().min(3).optional(),
});

/** Admin bootstrap for Anthropic API key into platform_secrets (Outreach HQ, Content Calendar, analytics). */
export async function POST(req: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid Anthropic key payload." }, { status: 400 });
  }

  await prisma.platformSecret.upsert({
    where: { key: "ANTHROPIC_API_KEY" },
    create: { key: "ANTHROPIC_API_KEY", value: body.anthropicApiKey },
    update: { value: body.anthropicApiKey },
  });

  if (body.anthropicModel?.trim()) {
    await prisma.platformSecret.upsert({
      where: { key: "ANTHROPIC_ADMIN_ANALYTICS_MODEL" },
      create: { key: "ANTHROPIC_ADMIN_ANALYTICS_MODEL", value: body.anthropicModel.trim() },
      update: { value: body.anthropicModel.trim() },
    });
  }

  clearPlatformSecretCache();

  return NextResponse.json({
    ok: true,
    message: "Anthropic keys stored in platform_secrets. Outreach HQ can now web-search real profiles.",
  });
}
