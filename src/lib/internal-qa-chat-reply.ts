import { prisma } from "@/lib/prisma";

function heuristicTrainerReply(clientMessage: string): string {
  const t = clientMessage.toLowerCase();
  if (t.includes("price") || t.includes("cost") || t.includes("how much")) {
    return "Great question — packages depend on frequency and whether we go virtual or in-person. What budget range were you hoping to stay within?";
  }
  if (t.includes("schedule") || t.includes("time") || t.includes("when")) {
    return "I’m pretty flexible weekday mornings and a few evenings. What timezone are you in, and what does a typical week look like for you?";
  }
  if (t.includes("nutrition") || t.includes("diet") || t.includes("macros")) {
    return "Nutrition is a big lever. Are you looking for full meal guidance, or more of a high-level habits approach alongside training?";
  }
  if (t.includes("injury") || t.includes("hurt") || t.includes("pain")) {
    return "Thanks for flagging that — safety first. Are you currently cleared for exercise by a clinician, and what movements tend to feel best vs. irritate it?";
  }
  return "Thanks for the message — I’m here to help. Tell me a bit about your current routine and what “success” looks like for you in the next 8–12 weeks.";
}

function heuristicClientReply(trainerMessage: string): string {
  const t = trainerMessage.toLowerCase();
  if (t.includes("?")) {
    return "Good question — I’m still figuring out the details, but I’m motivated and coachable. What would you recommend as a first step?";
  }
  return "That sounds helpful. I’m interested — what would onboarding look like in the first couple of weeks?";
}

async function openAiRoleplayReply(args: {
  role: "TRAINER" | "CLIENT";
  peerLabel: string;
  lastMessage: string;
}): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || args.lastMessage.length > 4000) return null;
  const model = process.env.OPENAI_CHAT_COMPLIANCE_MODEL?.trim() || "gpt-4o-mini";
  const system =
    args.role === "TRAINER"
      ? "You are a professional fitness coach replying in a marketplace chat. Be concise (max 3 sentences), warm, and practical. " +
        "Do not claim credentials you were not given. No medical diagnosis. No off-platform payment instructions."
      : "You are a motivated prospective client replying to a coach. Be concise (max 3 sentences), friendly, and realistic. " +
        "No off-platform payment talk.";

  const payload = {
    model,
    temperature: 0.7,
    messages: [
      { role: "system" as const, content: system },
      {
        role: "user" as const,
        content: `${args.peerLabel} wrote: ${args.lastMessage}\n\nWrite the next short reply as the ${args.role === "TRAINER" ? "coach" : "client"}.`,
      },
    ],
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = raw.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return text.slice(0, 1200);
  } catch {
    return null;
  }
}

/** After a real QA user messages a synthetic persona, append one auto-reply message. */
export async function maybeAppendInternalQaSyntheticChatReply(args: {
  conversationId: string;
  trainerIsSynthetic: boolean;
  clientIsSynthetic: boolean;
  lastAuthorRole: "TRAINER" | "CLIENT";
  lastBody: string;
}): Promise<void> {
  if (!args.trainerIsSynthetic && !args.clientIsSynthetic) return;
  if (args.trainerIsSynthetic && args.clientIsSynthetic) return;

  const replyRole: "TRAINER" | "CLIENT" =
    args.lastAuthorRole === "CLIENT" ? "TRAINER" : "CLIENT";

  const conv = await prisma.trainerClientConversation.findUnique({
    where: { id: args.conversationId },
    include: {
      trainer: { select: { internalQaSyntheticPersona: true, preferredName: true, firstName: true } },
      client: { select: { internalQaSyntheticPersona: true, preferredName: true, firstName: true } },
    },
  });
  if (!conv?.officialChatStartedAt) return;

  let body: string | null = null;
  const peerLabel =
    args.lastAuthorRole === "CLIENT"
      ? "Client"
      : `Coach ${conv.trainer.preferredName?.trim() || conv.trainer.firstName}`;

  if (args.trainerIsSynthetic && replyRole === "TRAINER") {
    body =
      (await openAiRoleplayReply({
        role: "TRAINER",
        peerLabel: "Client",
        lastMessage: args.lastBody,
      })) ?? heuristicTrainerReply(args.lastBody);
  } else if (args.clientIsSynthetic && replyRole === "CLIENT") {
    body =
      (await openAiRoleplayReply({
        role: "CLIENT",
        peerLabel,
        lastMessage: args.lastBody,
      })) ?? heuristicClientReply(args.lastBody);
  }

  if (!body?.trim()) return;

  await prisma.trainerClientChatMessage.create({
    data: {
      conversationId: args.conversationId,
      authorRole: replyRole,
      body: body.trim(),
    },
  });
  await prisma.trainerClientConversation.update({
    where: { id: args.conversationId },
    data: { updatedAt: new Date() },
  });
}
