const INITIAL_CAP = 2;

export type ChatRole = "TRAINER" | "CLIENT";

function orderedCounts(messages: { authorRole: string }[]) {
  let trainer = 0;
  let client = 0;
  for (const m of messages) {
    if (m.authorRole === "TRAINER") trainer += 1;
    else if (m.authorRole === "CLIENT") client += 1;
  }
  return { trainer, client };
}

/** Each side may send at most two messages until the other party has sent at least one (Terms §8). */
export function canAuthorSendChatMessage(
  messages: { authorRole: string }[],
  author: ChatRole,
): { ok: true } | { ok: false; reason: string } {
  const { trainer, client } = orderedCounts(messages);
  if (author === "TRAINER") {
    if (client > 0 || trainer < INITIAL_CAP) return { ok: true };
    return {
      ok: false,
      reason: `You can send up to ${INITIAL_CAP} messages until the client replies.`,
    };
  }
  if (trainer > 0 || client < INITIAL_CAP) return { ok: true };
  return {
    ok: false,
    reason: `You can send up to ${INITIAL_CAP} messages until the coach replies.`,
  };
}
