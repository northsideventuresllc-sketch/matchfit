import { purgeExpiredRegistrationHolds } from "@/lib/purge-registration-holds";
import { prisma } from "@/lib/prisma";
import {
  clearRegistrationHoldCookie,
  getRegistrationHoldPendingId,
} from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * Permanently deletes the in-progress registration tied to this browser.
 * Call when the user cancels checkout or leaves without paying.
 */
export async function POST() {
  try {
    await purgeExpiredRegistrationHolds();
    const holdId = await getRegistrationHoldPendingId();
    if (holdId) {
      await prisma.pendingClientRegistration.deleteMany({
        where: { id: holdId },
      });
    }
    await clearRegistrationHoldCookie();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not cancel registration." }, { status: 500 });
  }
}
