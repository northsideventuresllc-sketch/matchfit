import { prisma } from "@/lib/prisma";

export type AdministratorAuditAction = "IMPERSONATION_START" | "IMPERSONATION_END";

function requestMeta(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    null;
  const userAgent = req.headers.get("user-agent");
  return {
    ipAddress: ip,
    userAgent: userAgent && userAgent.length <= 512 ? userAgent : userAgent?.slice(0, 512) ?? null,
  };
}

export async function logAdministratorAuditEvent(args: {
  administratorId: string;
  action: AdministratorAuditAction;
  targetRole: "client" | "trainer";
  targetId: string;
  targetUsername?: string | null;
  req?: Request;
}): Promise<void> {
  const meta = args.req ? requestMeta(args.req) : { ipAddress: null, userAgent: null };
  try {
    await prisma.administratorAuditLog.create({
      data: {
        administratorId: args.administratorId,
        action: args.action,
        targetRole: args.targetRole,
        targetId: args.targetId,
        targetUsername: args.targetUsername?.trim() || undefined,
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
      },
    });
  } catch (e) {
    console.error("[administrator audit log]", e);
  }
}
