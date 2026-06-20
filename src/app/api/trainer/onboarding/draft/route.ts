import { prisma } from "@/lib/prisma";
import { getSupabaseRouteUser } from "@/lib/supabase/route-user";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Resume-draft fields only — never the plaintext password. The trainer re-enters
 * their password when resuming because we don't persist it server-side.
 */
const draftDataSchema = z
  .object({
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    username: z.string().trim().max(32).optional(),
    phone: z.string().trim().max(32).optional(),
    email: z.string().trim().email().max(254).optional(),
    serviceZipCode: z.string().trim().max(12).optional(),
    betaInviteToken: z.string().trim().max(200).optional(),
    agreedToTerms: z.boolean().optional(),
    stayLoggedIn: z.boolean().optional(),
  })
  .strict();

const patchBodySchema = z.object({ data: draftDataSchema });

export async function GET() {
  try {
    const user = await getSupabaseRouteUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const draft = await prisma.trainerDraft.findUnique({ where: { userId: user.id } });
    return NextResponse.json({ ok: true, data: draft?.data ?? null, email: draft?.email ?? user.email ?? null });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not load your sign-up draft.", {
      logLabel: "[Match Fit trainer onboarding draft GET]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getSupabaseRouteUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = patchBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const email = (parsed.data.data.email ?? user.email ?? "").trim().toLowerCase() || null;
    const draft = await prisma.trainerDraft.upsert({
      where: { userId: user.id },
      create: { userId: user.id, email, data: parsed.data.data },
      update: { email, data: parsed.data.data },
    });

    return NextResponse.json({ ok: true, data: draft.data });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save your sign-up draft.", {
      logLabel: "[Match Fit trainer onboarding draft PATCH]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  try {
    const user = await getSupabaseRouteUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await prisma.trainerDraft.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not clear your sign-up draft.", {
      logLabel: "[Match Fit trainer onboarding draft DELETE]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
