import { NextResponse } from "next/server";
import { z } from "zod";
import { assignBulkAudiencesWithAi } from "@/lib/content-calendar/content-calendar-ai";
import { CONTENT_CALENDAR_GROUPS, CONTENT_CALENDAR_POST_TYPES } from "@/lib/content-calendar/constants";
import { getContentCalendarAiStatusAsync } from "@/lib/content-calendar/content-calendar-ai";
import { requireAdminSession } from "@/lib/require-admin";

const assignSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        postType: z.enum(CONTENT_CALENDAR_POST_TYPES),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const ai = await getContentCalendarAiStatusAsync();
  if (!ai.configured) {
    return NextResponse.json({ error: ai.message }, { status: 503 });
  }

  const parsed = assignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const { items } = parsed.data;
    const defaultGroup = CONTENT_CALENDAR_GROUPS[0];
    const bulkItems = items.map((item) => ({
      postType: item.postType,
      targetGroup: defaultGroup,
    }));
    const aiAssignments = await assignBulkAudiencesWithAi(bulkItems);

    const assignments: Record<string, string> = {};
    items.forEach((item, i) => {
      const group = aiAssignments[i];
      assignments[item.id] = CONTENT_CALENDAR_GROUPS.includes(group as (typeof CONTENT_CALENDAR_GROUPS)[number])
        ? group
        : defaultGroup;
    });

    return NextResponse.json({ assignments });
  } catch (e) {
    console.error("[content-calendar bulk-assign-audiences]", e);
    return NextResponse.json({ error: "Audience assignment failed." }, { status: 500 });
  }
}
