import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/require-admin";
import { listTransactionalEmailTemplatesForAdmin } from "@/lib/transactional-email-template-store";
import { adminCanDirectEditEmailTemplates } from "@/lib/match-fit-email-template-owner";

export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.administrator.findUnique({
    where: { id: sess.adminId },
    select: { adminCode: true },
  });
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await listTransactionalEmailTemplatesForAdmin();
  return NextResponse.json({
    templates,
    canDirectEdit: adminCanDirectEditEmailTemplates(admin.adminCode),
    adminCode: admin.adminCode,
  });
}
