import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import {
  sendEmailTemplateChangeApprovedNotice,
} from "@/lib/admin-email-template-change-email";
import { verifyEmailTemplateChangeDecisionToken } from "@/lib/email-template-change-token";
import { applyPendingEmailTemplateChange } from "@/lib/transactional-email-template-store";
import type { TransactionalEmailKind } from "@/lib/transactional-email-kinds";

function redirectOutcome(req: Request, query: Record<string, string>) {
  const origin = getAppOriginFromRequest(req);
  const u = new URL("/admin/email-templates", origin);
  for (const [k, v] of Object.entries(query)) {
    u.searchParams.set(k, v);
  }
  return NextResponse.redirect(u);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim();
    if (!token) {
      return redirectOutcome(req, { decision: "invalid" });
    }

    const decision = await verifyEmailTemplateChangeDecisionToken(token);
    if (!decision || decision.action !== "approve") {
      return redirectOutcome(req, { decision: "invalid" });
    }

    const pending = await prisma.pendingTransactionalEmailTemplateChange.findUnique({
      where: { id: decision.pendingId },
      include: {
        requestedByAdmin: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    if (!pending) {
      return redirectOutcome(req, { decision: "missing" });
    }

    if (pending.status !== "PENDING") {
      return redirectOutcome(req, { decision: "already" });
    }

    const kind = await applyPendingEmailTemplateChange(pending.id);
    if (!kind) {
      return redirectOutcome(req, { decision: "error" });
    }

    if (pending.requestedByAdmin?.email) {
      await sendEmailTemplateChangeApprovedNotice({
        to: pending.requestedByAdmin.email,
        kind: kind as TransactionalEmailKind,
        requesterName: `${pending.requestedByAdmin.firstName} ${pending.requestedByAdmin.lastName}`.trim(),
      }).catch((e) => console.error("[email-template-change approve notice]", e));
    }

    return redirectOutcome(req, { decision: "approved", kind });
  } catch (e) {
    console.error("[email-template-change-decision]", e);
    return redirectOutcome(req, { decision: "error" });
  }
}
