import { NextResponse } from "next/server";
import { z } from "zod";
import { purgeActiveOutreachLeads, purgeArchivedOutreachLeads } from "@/lib/outreach-data";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  scope: z.enum(["archived", "active", "all"]).default("archived"),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const archived =
      parsed.data.scope === "archived" || parsed.data.scope === "all"
        ? await purgeArchivedOutreachLeads()
        : { instagram: 0, facebook: 0, email: 0 };
    const active =
      parsed.data.scope === "active" || parsed.data.scope === "all"
        ? await purgeActiveOutreachLeads()
        : { instagram: 0, facebook: 0, email: 0 };

    const removed = {
      instagram: archived.instagram + active.instagram,
      facebook: archived.facebook + active.facebook,
      email: archived.email + active.email,
    };
    const total = removed.instagram + removed.facebook + removed.email;

    return NextResponse.json({
      ok: true,
      scope: parsed.data.scope,
      removed,
      total,
      message:
        total > 0
          ? `Removed ${total} outreach row(s). Generate with AI to refill with verified leads.`
          : "No outreach rows matched that purge scope.",
    });
  } catch (e) {
    console.error("[outreach purge]", e);
    return NextResponse.json({ error: "Could not purge outreach leads." }, { status: 500 });
  }
}
