import { NextResponse } from "next/server";
import { z } from "zod";
import { runContentCuratorChat } from "@/lib/content-calendar/content-calendar-ai";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(40),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const result = await runContentCuratorChat(parsed.data.messages);
    if (!result) {
      return NextResponse.json({ error: "Curator unavailable. Check AI API keys." }, { status: 502 });
    }
    return NextResponse.json({ result });
  } catch (e) {
    console.error("[content-calendar curator-chat]", e);
    return NextResponse.json({ error: "Curator request failed." }, { status: 500 });
  }
}
