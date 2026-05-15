import { getValidBetaInvite } from "@/lib/beta-waitlist-service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim();
  const inv = await getValidBetaInvite(token);
  if (!inv) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }
  return NextResponse.json({
    valid: true,
    role: inv.role,
    firstName: inv.firstName,
    email: inv.email,
    desiredUsername: inv.desiredUsername,
    entryId: inv.entryId,
  });
}
