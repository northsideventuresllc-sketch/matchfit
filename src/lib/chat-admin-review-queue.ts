import { prisma } from "@/lib/prisma";

const EXCERPT_MAX = 400;

export async function queueChatAdminReview(args: {
  conversationId: string;
  authorRole: "TRAINER" | "CLIENT";
  signals: string[];
  body: string;
}): Promise<void> {
  if (args.signals.length === 0) return;
  const excerpt = args.body.trim().slice(0, EXCERPT_MAX);
  await prisma.chatAdminReviewItem.create({
    data: {
      conversationId: args.conversationId,
      authorRole: args.authorRole,
      matchedSignalsJson: JSON.stringify(args.signals),
      bodyExcerpt: excerpt,
      status: "PENDING",
    },
  });
}
