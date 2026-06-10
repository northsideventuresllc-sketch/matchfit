import { NextResponse } from "next/server";
import { shouldShowMissedPrompt } from "@/lib/content-calendar/schedule-utils";
import { loadMissedPosts, serializePostForClient } from "@/lib/content-calendar/content-calendar-store";
import { isNiBrainConfigured } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!isNiBrainConfigured()) {
    return NextResponse.json({ posts: [] });
  }

  try {
    const candidates = await loadMissedPosts();
    const posts = candidates
      .filter((p) =>
        shouldShowMissedPrompt({
          postDate: p.post_date,
          posted: p.posted,
          missedPromptDismissed: p.missed_prompt_dismissed,
        }),
      )
      .map(serializePostForClient);
    return NextResponse.json({ posts });
  } catch (e) {
    console.error("[content-calendar missed]", e);
    return NextResponse.json({ posts: [] });
  }
}
