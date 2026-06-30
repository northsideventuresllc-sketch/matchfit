/**
 * Stripe webhook signature verification requires the exact raw request bytes.
 * Read the body before any other async work (including env hydration).
 */
export async function readStripeWebhookRawBody(req: Request): Promise<Buffer> {
  return Buffer.from(await req.arrayBuffer());
}
