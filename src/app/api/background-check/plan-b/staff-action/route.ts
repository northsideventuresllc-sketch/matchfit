import {
  applyPlanBBackgroundCheckStaffDecision,
  confirmPlanBBackgroundCheckInviteSent,
} from "@/lib/background-check-plan-b";
import { verifyBackgroundCheckStaffToken } from "@/lib/background-check-action-token";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function redirectStaffOutcome(req: Request, query: Record<string, string>) {
  const origin = getAppOriginFromRequest(req);
  const u = new URL("/trainer/onboarding/background-check/staff-result", origin);
  for (const [k, v] of Object.entries(query)) {
    u.searchParams.set(k, v);
  }
  return NextResponse.redirect(u);
}

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token")?.trim();
    if (!token) {
      return redirectStaffOutcome(req, { outcome: "invalid" });
    }

    const verified = await verifyBackgroundCheckStaffToken(token);
    if (!verified) {
      return redirectStaffOutcome(req, { outcome: "invalid" });
    }

    if (verified.action === "confirm_invite_sent") {
      const result = await confirmPlanBBackgroundCheckInviteSent(verified.trainerId);
      return redirectStaffOutcome(req, {
        outcome: result.ok ? "invite_confirmed" : "error",
        message: result.message,
      });
    }

    if (verified.action === "approve" || verified.action === "deny") {
      const result = await applyPlanBBackgroundCheckStaffDecision(verified.trainerId, verified.action);
      return redirectStaffOutcome(req, {
        outcome: result.ok ? verified.action : "error",
        message: result.message,
      });
    }

    return redirectStaffOutcome(req, { outcome: "invalid" });
  } catch (e) {
    console.error("[background-check plan-b staff-action]", e);
    return redirectStaffOutcome(req, { outcome: "error" });
  }
}
