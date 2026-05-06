import { trainerSetManualBookingVideo, trainerSyncBookingVideoFromOAuth } from "@/lib/trainer-booking-video-sync";
import { getSessionTrainerId } from "@/lib/session";
import type { VideoConferenceProviderKey } from "@/lib/trainer-video-oauth-state";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("manual"),
    joinUrl: z.string().trim().min(8).max(2000),
  }),
  z.object({
    action: z.literal("sync"),
    provider: z.enum(["GOOGLE", "ZOOM", "MICROSOFT"]),
  }),
]);

type Ctx = { params: Promise<{ bookingId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { bookingId } = await ctx.params;
    const id = decodeURIComponent(bookingId).trim();
    if (!id) {
      return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    if (parsed.data.action === "manual") {
      const r = await trainerSetManualBookingVideo({
        trainerId,
        bookingId: id,
        joinUrl: parsed.data.joinUrl,
      });
      if ("error" in r) {
        return NextResponse.json({ error: r.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }
    const r = await trainerSyncBookingVideoFromOAuth({
      trainerId,
      bookingId: id,
      provider: parsed.data.provider as VideoConferenceProviderKey,
    });
    if ("error" in r) {
      return NextResponse.json({ error: r.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, joinUrl: r.joinUrl });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update video link." }, { status: 500 });
  }
}
