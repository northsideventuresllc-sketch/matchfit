import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { clearPlatformSecretCache } from "@/lib/platform-secrets";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  anthropicApiKey: z.string().startsWith("sk-ant-"),
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

  clearPlatformSecretCache();
  process.env.ANTHROPIC_API_KEY = body.anthropicApiKey;

  return NextResponse.json({ ok: true, message: "Anthropic API key stored for admin AI features." });
}
