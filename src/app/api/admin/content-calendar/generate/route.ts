import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSinglePost } from "@/lib/content-calendar/content-calendar-ai";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  postType: z.enum(["Carousel", "Static", "Video"]).optional(),
  platform: z.string().min(1).optional(),
  contentType: z.string().min(1),
  tone: z.string().min(1),
  customNote: z.string().optional(),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await hydratePlatformEnvFromDatabase();
    const result = await generateSinglePost(parsed.data);
    if (!result) {
      return NextResponse.json({ error: "Generation failed. Check AI API keys." }, { status: 502 });
    }
    return NextResponse.json({ result });
  } catch (e) {
    console.error("[content-calendar generate]", e);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
