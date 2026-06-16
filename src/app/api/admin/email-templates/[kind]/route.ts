import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/require-admin";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { sendEmailTemplateChangeApprovalRequest } from "@/lib/admin-email-template-change-email";
import { adminCanDirectEditEmailTemplates } from "@/lib/match-fit-email-template-owner";
import { TRANSACTIONAL_EMAIL_KINDS, type TransactionalEmailKind } from "@/lib/transactional-email-kinds";
import { getDefaultTransactionalEmailTemplateFields } from "@/lib/transactional-email-template-defaults";
import {
  mergeTransactionalEmailTemplateFields,
  serializeTransactionalEmailTemplateFields,
  type TransactionalEmailTemplateFields,
} from "@/lib/transactional-email-template-types";
import {
  getEffectiveTransactionalEmailTemplateFields,
  previewTransactionalEmailTemplate,
  saveTransactionalEmailTemplateOverride,
  validateTransactionalEmailTemplateFields,
} from "@/lib/transactional-email-template-store";
import { ensureEmailTemplateSchema } from "@/lib/ensure-email-template-schema";

function isKind(value: string): value is TransactionalEmailKind {
  return (TRANSACTIONAL_EMAIL_KINDS as readonly string[]).includes(value);
}

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { kind: kindParam } = await ctx.params;
  if (!isKind(kindParam)) return NextResponse.json({ error: "Unknown template." }, { status: 404 });

  const fields = await getEffectiveTransactionalEmailTemplateFields(kindParam);
  const preview = previewTransactionalEmailTemplate(kindParam, fields);
  return NextResponse.json({ kind: kindParam, fields, preview });
}

export async function PUT(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.administrator.findUnique({
    where: { id: sess.adminId },
    select: { id: true, adminCode: true, firstName: true, lastName: true, email: true },
  });
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { kind: kindParam } = await ctx.params;
  if (!isKind(kindParam)) return NextResponse.json({ error: "Unknown template." }, { status: 404 });

  let body: { fields?: TransactionalEmailTemplateFields; confirmed?: boolean };
  try {
    body = (await req.json()) as { fields?: TransactionalEmailTemplateFields; confirmed?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.fields) return NextResponse.json({ error: "fields required." }, { status: 400 });

  const defaults = getDefaultTransactionalEmailTemplateFields(kindParam);
  const merged = mergeTransactionalEmailTemplateFields(defaults, body.fields);
  merged.layout = defaults.layout;

  const validationError = validateTransactionalEmailTemplateFields(kindParam, merged);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const canDirectEdit = adminCanDirectEditEmailTemplates(admin.adminCode);
  if (canDirectEdit && !body.confirmed) {
    return NextResponse.json(
      {
        error: "confirmation_required",
        message:
          "You are changing the contents of this email, meaning all clients who receive will get this version of the email, not the prior one. Are you sure you want to go through with this?",
      },
      { status: 409 },
    );
  }

  await ensureEmailTemplateSchema();

  if (canDirectEdit) {
    await saveTransactionalEmailTemplateOverride({
      kind: kindParam,
      fields: merged,
      adminId: admin.id,
    });
    return NextResponse.json({ ok: true, applied: true });
  }

  await prisma.pendingTransactionalEmailTemplateChange.updateMany({
    where: { kind: kindParam, status: "PENDING", requestedByAdminId: admin.id },
    data: { status: "DENIED", reviewNotes: "Superseded by a newer submission.", reviewedAt: new Date() },
  });

  const pending = await prisma.pendingTransactionalEmailTemplateChange.create({
    data: {
      kind: kindParam,
      fieldsJson: serializeTransactionalEmailTemplateFields(merged),
      requestedByAdminId: admin.id,
    },
  });

  const origin = getAppOriginFromRequest(req);
  await sendEmailTemplateChangeApprovalRequest({
    pendingId: pending.id,
    kind: kindParam,
    fields: merged,
    requesterName: `${admin.firstName} ${admin.lastName}`.trim(),
    requesterCode: admin.adminCode,
    origin,
  });

  return NextResponse.json({
    ok: true,
    applied: false,
    pendingApproval: true,
    message: "Your change was sent to jb@match-fit.net for approval.",
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { kind: kindParam } = await ctx.params;
  if (!isKind(kindParam)) return NextResponse.json({ error: "Unknown template." }, { status: 404 });

  let body: { fields?: TransactionalEmailTemplateFields };
  try {
    body = (await req.json()) as { fields?: TransactionalEmailTemplateFields };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const defaults = getDefaultTransactionalEmailTemplateFields(kindParam);
  const merged = body.fields ? mergeTransactionalEmailTemplateFields(defaults, body.fields) : defaults;
  merged.layout = defaults.layout;

  const preview = previewTransactionalEmailTemplate(kindParam, merged);
  return NextResponse.json({ preview });
}
