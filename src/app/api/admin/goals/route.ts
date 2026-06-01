import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  targetMetric: z.string().max(64).optional(),
  targetValue: z.number().int().positive().optional(),
  deadline: z.string().datetime().optional(),
});

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const goals = await prisma.adminGoal.findMany({
    where: { administratorId: sess.adminId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    goals: goals.map((g) => ({
      ...g,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      deadline: g.deadline?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid goal." }, { status: 400 });
  const goal = await prisma.adminGoal.create({
    data: {
      administratorId: sess.adminId,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim(),
      targetMetric: parsed.data.targetMetric?.trim(),
      targetValue: parsed.data.targetValue,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
    },
  });
  return NextResponse.json({ goal: { ...goal, createdAt: goal.createdAt.toISOString() } });
}
