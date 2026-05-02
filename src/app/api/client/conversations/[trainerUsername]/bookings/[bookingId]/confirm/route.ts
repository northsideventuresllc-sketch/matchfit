import { clientConfirmBooking } from "@/lib/trainer-client-booking-service";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ trainerUsername: string; bookingId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { bookingId } = await ctx.params;
    const res = await clientConfirmBooking({ bookingId, clientId });
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not confirm." }, { status: 500 });
  }
}
