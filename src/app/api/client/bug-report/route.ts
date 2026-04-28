import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { NextResponse } from "next/server";

const CATEGORIES = new Set([
  "MATCHING_ISSUE",
  "CHAT_ISSUE",
  "BILLING_ISSUE",
  "NOTIFICATION_ISSUE",
  "LOGIN_OR_ACCOUNT",
  "PERFORMANCE_OR_BUG",
  "OTHER",
]);

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

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
      return NextResponse.json({ error: "Please choose a report category." }, { status: 400 });
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

    await prisma.clientBugReport.create({
      data: {
        clientId,
        anonymous,
        reporterName: anonymous ? null : name,
        reporterEmail: email,
        category,
        description,
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        "Your report has been sent. Thank you for helping us improve the Match Fit experience.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not submit report." }, { status: 500 });
  }
}
