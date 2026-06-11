import { Prisma } from "@/generated/prisma/client";
import { cookies } from "next/headers";
import {
  adminPortalClientListWhere,
  adminPortalClientListWhereLegacy,
  adminPortalTrainerDirectoryWhere,
  adminPortalTrainerDirectoryWhereLegacy,
  redactEmailForAdminPortal,
} from "@/lib/admin-portal-list-filters";
import { filterOwnerTestIdentities } from "@/lib/owner-test-account-exclusion";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
import {
  buildAdminClientSearchClause,
  buildAdminTrainerSearchClause,
  resolveTrainerMembershipStatus,
  trainerMembershipStatusLabel,
} from "@/lib/trainer-membership-status";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const store = await cookies();
    const adminTok = store.get(ADMIN_SESSION_COOKIE)?.value;
    const sess = adminTok ? await verifyAdminSessionToken(adminTok) : null;
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const ok = await prisma.administrator.findUnique({
      where: { id: sess.adminId },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const role = url.searchParams.get("role") ?? "both";

    const take = 40;

    const clientSearchClause = q ? buildAdminClientSearchClause(q) : undefined;
    const trainerSearchClause = q ? buildAdminTrainerSearchClause(q) : undefined;

    async function loadClients(clientWhere: ReturnType<typeof adminPortalClientListWhere>) {
      return prisma.client.findMany({
        where: clientSearchClause ? { AND: [clientWhere, clientSearchClause] } : clientWhere,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          email: true,
          preferredName: true,
          firstName: true,
          lastName: true,
          createdAt: true,
        },
      });
    }

    async function loadTrainers(trainerWhere: ReturnType<typeof adminPortalTrainerDirectoryWhere>) {
      return prisma.trainer.findMany({
        where: trainerSearchClause ? { AND: [trainerWhere, trainerSearchClause] } : trainerWhere,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          email: true,
          preferredName: true,
          firstName: true,
          lastName: true,
          termsAcceptedAt: true,
          deidentifiedAt: true,
          createdAt: true,
          profile: {
            select: {
              hasSignedTOS: true,
              dashboardActivatedAt: true,
              complianceWindowStartedAt: true,
              limitedDashboardUnlockedAt: true,
              registrationFeeHoldStatus: true,
              hasPaidRegistrationFee: true,
            },
          },
        },
      });
    }

    const clients =
      role === "trainer"
        ? []
        : await loadClients(adminPortalClientListWhere()).catch((e) => {
            if (!isMissingInternalQaSyntheticPersonaColumn(e)) throw e;
            return loadClients(adminPortalClientListWhereLegacy());
          });

    const trainers =
      role === "client"
        ? []
        : await loadTrainers(adminPortalTrainerDirectoryWhere()).catch((e) => {
            if (!isMissingInternalQaSyntheticPersonaColumn(e)) throw e;
            return loadTrainers(adminPortalTrainerDirectoryWhereLegacy());
          });

    const visibleClients = filterOwnerTestIdentities(clients, (c) => ({
      username: c.username,
      email: c.email,
      role: "client" as const,
    }));
    const visibleTrainers = filterOwnerTestIdentities(trainers, (t) => ({
      username: t.username,
      email: t.email,
      role: "trainer" as const,
    }));

    return NextResponse.json({
      clients: visibleClients.map((c) => ({
        kind: "client" as const,
        id: c.id,
        username: c.username,
        email: redactEmailForAdminPortal(c.email, c.username, "client"),
        displayName:
          c.preferredName?.trim() ||
          [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
          c.username,
        createdAt: c.createdAt.toISOString(),
      })),
      trainers: visibleTrainers.map((t) => {
        const membershipStatus = resolveTrainerMembershipStatus({
          trainer: { termsAcceptedAt: t.termsAcceptedAt, deidentifiedAt: t.deidentifiedAt },
          profile: t.profile,
        });
        return {
          kind: "trainer" as const,
          id: t.id,
          username: t.username,
          email: redactEmailForAdminPortal(t.email, t.username, "trainer"),
          displayName:
            t.preferredName?.trim() ||
            [t.firstName, t.lastName].filter(Boolean).join(" ").trim() ||
            t.username,
          createdAt: t.createdAt.toISOString(),
          membershipStatus,
          membershipStatusLabel: trainerMembershipStatusLabel(membershipStatus),
        };
      }),
    });
  } catch (e) {
    console.error("[admin users]", e);
    return NextResponse.json({ error: "Could not load directory." }, { status: 500 });
  }
}

function isMissingInternalQaSyntheticPersonaColumn(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const m = e.message;
  return m.includes("internalQaSyntheticPersona") && (m.includes("42703") || m.includes("does not exist"));
}
