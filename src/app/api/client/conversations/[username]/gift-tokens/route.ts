import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import {
  isTrainerVisibleInClientDiscovery,
  trainerBookableBlockedMessage,
  trainerDiscoveryProfileSelect,
} from "@/lib/trainer-client-discovery";
import { isTrainerClientChatBlocked } from "@/lib/user-block-queries";
import { clientGiftTokensToTrainer } from "@/lib/trainer-promo-tokens";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amount: z.number().int().min(1).max(100),
});

type RouteContext = { params: Promise<{ username: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const { username } = await ctx.params;
    const handle = decodeURIComponent(username).trim();
    const trainer = await prisma.trainer.findUnique({
      where: { username: handle },
      select: {
        id: true,
        profile: {
          select: trainerDiscoveryProfileSelect,
        },
      },
    });
    if (!trainer?.profile || !isTrainerVisibleInClientDiscovery(trainer.profile)) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }
    const bookableBlock = trainerBookableBlockedMessage(trainer.profile);
    if (bookableBlock) {
      return NextResponse.json({ error: bookableBlock, code: "TRAINER_VERIFICATION_IN_PROGRESS" }, { status: 403 });
    }
    if (await isTrainerClientChatBlocked(trainer.id, clientId)) {
      return NextResponse.json({ error: "Unavailable." }, { status: 403 });
    }
    const conv = await prisma.trainerClientConversation.findUnique({
      where: { trainerId_clientId: { trainerId: trainer.id, clientId } },
      select: { id: true, officialChatStartedAt: true, archivedAt: true },
    });
    if (conv?.archivedAt) {
      return NextResponse.json({ error: "This chat is archived." }, { status: 403 });
    }
    if (!conv?.officialChatStartedAt) {
      return NextResponse.json({ error: "Chat is not open for this coach yet." }, { status: 403 });
    }
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }
    const result = await clientGiftTokensToTrainer({
      clientId,
      trainerUsername: handle,
      amount: parsed.data.amount,
      announceConversationId: conv.id,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not send tokens." }, { status: 500 });
  }
}
