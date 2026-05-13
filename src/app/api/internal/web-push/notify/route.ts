import { sendWebPushToClient, sendWebPushToTrainer } from "@/lib/web-push-send";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  audience: z.enum(["CLIENT", "TRAINER"]),
  userId: z.string().min(1),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  url: z.string().max(512).optional(),
});

/**
 * Ops / cron: deliver a Web Push to one user. Guard with `MATCHFIT_INTERNAL_TOOLS_SECRET`.
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.MATCHFIT_INTERNAL_TOOLS_SECRET?.trim();
    if (!secret || secret.length < 16) {
      return NextResponse.json({ error: "Internal tools are not configured." }, { status: 503 });
    }
    if (req.headers.get("x-matchfit-internal-secret") !== secret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }
    const { audience, userId, title, body, url: urlRaw } = parsed.data;
    const url =
      urlRaw && urlRaw.startsWith("/") && !urlRaw.startsWith("//") ? urlRaw.slice(0, 512) : undefined;

    const payload = { title, body, url };

    const result =
      audience === "CLIENT"
        ? await sendWebPushToClient(userId, payload)
        : await sendWebPushToTrainer(userId, payload);

    return NextResponse.json({ ok: true, sent: result.sent });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Push delivery failed." }, { status: 500 });
  }
}
