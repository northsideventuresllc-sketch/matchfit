import { createHmac, timingSafeEqual } from "node:crypto";
import { getCheckrWebhookSecret } from "@/lib/checkr/config";

/** Verifies Checkr webhook signature (`X-Checkr-Signature` header). */
export function verifyCheckrWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = getCheckrWebhookSecret();
  if (!secret || !signatureHeader?.trim()) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.trim().replace(/^sha256=/, "");

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(provided, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
