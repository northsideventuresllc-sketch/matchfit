import { webPushSubscriptionJsonSchema } from "@/lib/web-push-subscription-schema";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const json = await req.json();
    const parsed = webPushSubscriptionJsonSchema.safeParse(json.subscription ?? json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid subscription payload." }, { status: 400 });
    }
    const sub = parsed.data;
    const ua = req.headers.get("user-agent")?.slice(0, 512) ?? null;

    await prisma.webPushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        trainerId,
        userAgent: ua,
      },
      update: {
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        trainerId,
        clientId: null,
        userAgent: ua,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save push subscription.", {
      logLabel: "[trainer web-push]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const json = (await req.json()) as { endpoint?: string };
    const endpoint = typeof json.endpoint === "string" ? json.endpoint.trim() : "";
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint is required." }, { status: 400 });
    }
    await prisma.webPushSubscription.deleteMany({
      where: { trainerId, endpoint },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not remove push subscription.", {
      logLabel: "[trainer web-push delete]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
