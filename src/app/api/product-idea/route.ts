import { notifyMatchFitSupportInbox } from "@/lib/match-fit-support-inbox";
import { prisma } from "@/lib/prisma";
import { getRequestClientIp } from "@/lib/request-client-ip";
import { getSessionClientId, getSessionTrainerId } from "@/lib/session";
import { simpleRateLimitAllow } from "@/lib/simple-rate-limit";
import { NextResponse } from "next/server";

const CATEGORIES = new Set([
  "NEW_FEATURE",
  "UX_OR_DESIGN",
  "MATCHING_OR_DISCOVERY",
  "MESSAGING_OR_CHAT",
  "FIT_HUB_OR_SOCIAL",
  "BILLING_OR_PAYMENTS",
  "TRAINER_TOOLS",
  "CLIENT_TOOLS",
  "OTHER",
]);

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const ip = getRequestClientIp(req);
    if (!simpleRateLimitAllow(`product-idea:${ip}`, 8, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
    }
    const [clientIdSession, trainerIdSession] = await Promise.all([getSessionClientId(), getSessionTrainerId()]);

    const body = (await req.json().catch(() => ({}))) as {
      anonymous?: boolean;
      name?: string;
      email?: string;
      category?: string;
      description?: string;
    };

    const anonymous = body.anonymous === true;
    const name = body.name?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const category = body.category?.trim() ?? "";
    const description = body.description?.trim() ?? "";

    if (!CATEGORIES.has(category)) {
      return NextResponse.json({ error: "Please choose an idea category." }, { status: 400 });
    }
    if (!description || description.length < 10 || description.length > 5000) {
      return NextResponse.json({ error: "Description must be between 10 and 5000 characters." }, { status: 400 });
    }
    if (!anonymous && !name) {
      return NextResponse.json({ error: "Please enter your name or choose anonymous." }, { status: 400 });
    }
    if (!email || !validEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const clientId = clientIdSession ?? null;
    const trainerId = clientId ? null : trainerIdSession ?? null;

    const row = await prisma.productIdeaSubmission.create({
      data: {
        clientId,
        trainerId,
        anonymous,
        reporterName: anonymous ? null : name,
        reporterEmail: email,
        category,
        description,
      },
    });

    const audience = clientId ? "client" : trainerId ? "trainer" : "public";
    void notifyMatchFitSupportInbox({
      subject: `[Product idea] ${category} · ${row.id}`,
      text: [
        `Submission ID: ${row.id}`,
        `Category: ${category}`,
        `Audience: ${audience}`,
        `Client ID: ${clientId ?? "—"}`,
        `Trainer ID: ${trainerId ?? "—"}`,
        `Anonymous: ${anonymous}`,
        `Reporter: ${anonymous ? "(anonymous)" : name}`,
        `Email: ${email}`,
        "",
        description,
      ].join("\n"),
      replyTo: email,
    }).catch((e) => console.error("[product-idea] support inbox failed:", e));

    return NextResponse.json({
      ok: true,
      message: "Thanks — we received your idea. Our team reviews submissions regularly.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not submit your idea." }, { status: 500 });
  }
}
