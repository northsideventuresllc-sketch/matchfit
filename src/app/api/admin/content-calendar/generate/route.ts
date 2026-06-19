import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateSinglePost,
  getContentCalendarAiStatusAsync,
} from "@/lib/content-calendar/content-calendar-ai";
import { CONTENT_CALENDAR_GENERATOR_POST_TYPES } from "@/lib/content-calendar/constants";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  postType: z.enum(CONTENT_CALENDAR_GENERATOR_POST_TYPES).optional(),
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

  const ai = await getContentCalendarAiStatusAsync();
  if (!ai.configured) {
    return NextResponse.json({ error: ai.message }, { status: 503 });
  }

  try {
    const result = await generateSinglePost(parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({ result: result.data });
  } catch (e) {
    console.error("[content-calendar generate]", e);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
