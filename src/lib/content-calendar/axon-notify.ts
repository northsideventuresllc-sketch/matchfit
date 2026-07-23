import "server-only";

export type AxonPostingConfirmationPost = {
  platform: string;
  url: string;
  postedAt: string;
};

export type AxonPostingConfirmationPayload = {
  batchId: string;
  posts: AxonPostingConfirmationPost[];
};

/**
 * Fire-and-forget notification to the AXON posting-confirmation receiver. Contract is fixed and
 * shared with the AXON-side agent — body is exactly { batchId, posts: [{ platform, url, postedAt }] }.
 * The webhook URL is configured via AXON_POSTING_CONFIRMATION_WEBHOOK_URL (never hardcoded); when
 * unset the call is a no-op so posting completion never fails on a missing integration.
 */
export async function fireAxonPostingConfirmation(payload: AxonPostingConfirmationPayload): Promise<void> {
  const url = process.env.AXON_POSTING_CONFIRMATION_WEBHOOK_URL?.trim();
  if (!url) return;

  const body: AxonPostingConfirmationPayload = {
    batchId: payload.batchId,
    posts: payload.posts.map((p) => ({ platform: p.platform, url: p.url, postedAt: p.postedAt })),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = process.env.MATCH_FIT_WEBHOOK_SECRET?.trim();
  if (secret) headers["X-Match-Fit-Webhook-Secret"] = secret;

  try {
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    console.warn("[axon-notify] posting confirmation webhook failed", e);
  }
}
