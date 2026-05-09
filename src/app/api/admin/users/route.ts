import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/session";
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

    const clients =
      role === "trainer"
        ? []
        : await prisma.client.findMany({
            where: q
              ? {
                  deidentifiedAt: null,
                  OR: [
                    { username: { contains: q } },
                    { email: { contains: q } },
                    { phone: { contains: q } },
                  ],
                }
              : { deidentifiedAt: null },
            take,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              username: true,
              email: true,
              preferredName: true,
              createdAt: true,
            },
          });

    const trainers =
      role === "client"
        ? []
        : await prisma.trainer.findMany({
            where: q
              ? {
                  deidentifiedAt: null,
                  OR: [
                    { username: { contains: q } },
                    { email: { contains: q } },
                    { phone: { contains: q } },
                  ],
                }
              : { deidentifiedAt: null },
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

    return NextResponse.json({
      clients: clients.map((c) => ({
        kind: "client" as const,
        id: c.id,
        username: c.username,
        email: c.email,
        displayName: c.preferredName?.trim() || c.username,
        createdAt: c.createdAt.toISOString(),
      })),
      trainers: trainers.map((t) => ({
        kind: "trainer" as const,
        id: t.id,
        username: t.username,
        email: t.email,
        displayName:
          t.preferredName?.trim() ||
          [t.firstName, t.lastName].filter(Boolean).join(" ").trim() ||
          t.username,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[admin users]", e);
    return NextResponse.json({ error: "Could not load directory." }, { status: 500 });
  }
}
