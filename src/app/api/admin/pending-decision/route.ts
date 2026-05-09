import { canonicalAdministratorCode } from "@/lib/admin-code";
import { verifyAdminPendingDecisionToken } from "@/lib/admin-pending-decision-token";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function redirectOutcome(req: Request, query: Record<string, string>) {
  const origin = getAppOriginFromRequest(req);
  const u = new URL("/admin/sign-up", origin);
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

    const decision = await verifyAdminPendingDecisionToken(token);
    if (!decision) {
      return redirectOutcome(req, { decision: "invalid" });
    }

    const pending = await prisma.pendingAdministratorRegistration.findUnique({
      where: { id: decision.pendingId },
    });

    if (!pending) {
      return redirectOutcome(req, { decision: "missing" });
    }

    if (pending.status !== "PENDING") {
      return redirectOutcome(req, { decision: "already" });
    }

    if (decision.action === "deny") {
      await prisma.pendingAdministratorRegistration.update({
        where: { id: pending.id },
        data: { status: "DENIED" },
      });
      return redirectOutcome(req, { decision: "denied" });
    }

    const adminCode = canonicalAdministratorCode(
      pending.firstName,
      pending.lastName,
      pending.dateOfBirth,
    );
    if (!adminCode) {
      return redirectOutcome(req, { decision: "bad_code" });
    }

    const email = pending.email.trim().toLowerCase();

    try {
      await prisma.$transaction(async (tx) => {
        const clash = await tx.administrator.findFirst({
          where: {
            OR: [{ adminCode }, { email }],
          },
        });
        if (clash) {
          throw new Error("CLASH");
        }

        await tx.administrator.create({
          data: {
            adminCode,
            email,
            passwordHash: pending.passwordHash,
            firstName: pending.firstName,
            lastName: pending.lastName,
            dateOfBirth: pending.dateOfBirth,
          },
        });

        await tx.pendingAdministratorRegistration.delete({
          where: { id: pending.id },
        });
      });
    } catch (e) {
      if (e instanceof Error && e.message === "CLASH") {
        await prisma.pendingAdministratorRegistration.update({
          where: { id: pending.id },
          data: { status: "DENIED" },
        });
        return redirectOutcome(req, { decision: "clash" });
      }
      console.error("[admin pending-decision approve]", e);
      return redirectOutcome(req, { decision: "error" });
    }

    return redirectOutcome(req, { decision: "approved" });
  } catch (e) {
    console.error("[admin pending-decision]", e);
    return redirectOutcome(req, { decision: "error" });
  }
}
