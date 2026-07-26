import { NextResponse } from "next/server";
import { z } from "zod";
import { autoPost, type AutoPostTarget } from "@/lib/content-calendar/meta-auto-post";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  caption: z.string().min(1),
  imageUrl: z.string().url().optional(),
  targets: z.array(z.enum(["facebook", "instagram"])).min(1),
});

/** MF-AUTOPOST-ENDPOINT — publish an approved post straight to Meta. */
export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid auto-post request." }, { status: 400 });
  }

  try {
    const result = await autoPost({
      caption: parsed.data.caption,
      imageUrl: parsed.data.imageUrl,
      targets: parsed.data.targets as AutoPostTarget[],
    });

    // A permission gap is not a server fault — report it as a clear 409 so the
    // UI can show the one sentence that tells JB what to switch on.
    if (result.blocked) {
      return NextResponse.json({ ok: false, blocked: result.blocked }, { status: 409 });
    }

    return NextResponse.json({ ok: result.ok, results: result.results });
  } catch (e) {
    console.error("[content-calendar v2 auto-post]", e);
    return NextResponse.json({ error: "Could not publish the post." }, { status: 500 });
  }
}
