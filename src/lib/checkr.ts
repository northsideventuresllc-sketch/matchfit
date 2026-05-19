import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** Default mock Checkr charge when vendor is not wired (cents). */
export function defaultBackgroundCheckVendorPaidCents(): number {
  const raw = process.env.MATCH_FIT_CHECKR_DEFAULT_BG_FEE_CENTS?.trim();
  const n = Number.parseInt(raw ?? "", 10);
  if (Number.isFinite(n) && n > 0) return n;
  return 4900;
}

export type CheckrReportPaidPayload = {
  trainerId: string;
  reportId?: string;
  candidateId?: string;
  /** Amount the trainer paid Checkr in cents (from invoice or report object). */
  vendorPaidCents: number;
};

/**
 * Verify Checkr webhook HMAC-SHA256 (hex) against the raw request body.
 * @see https://github.com/checkr/webhook-verification-examples
 */
export function verifyCheckrWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  const signature = signatureHeader?.trim();
  if (!signature || !secret.trim()) return false;
  const computed = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(computed, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function recordCheckrBackgroundCheckPaid(payload: CheckrReportPaidPayload): Promise<void> {
  const cents = Math.max(1, Math.floor(payload.vendorPaidCents));
  await prisma.trainerProfile.update({
    where: { trainerId: payload.trainerId },
    data: {
      hasPaidBackgroundFee: true,
      backgroundCheckVendorPaidCents: cents,
      ...(payload.reportId ? { checkrReportId: payload.reportId } : {}),
      ...(payload.candidateId ? { checkrCandidateId: payload.candidateId } : {}),
      updatedAt: new Date(),
    },
  });
}

/**
 * Parse Checkr webhook JSON (untrusted). Returns null if not a paid/complete report we can use.
 * https://docs.checkr.com/ — shape varies by event type; we accept common fields.
 */
export function parseCheckrWebhookPaidCents(body: unknown): {
  reportId?: string;
  candidateId?: string;
  vendorPaidCents: number;
  externalTrainerId?: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const data = (o.data && typeof o.data === "object" ? o.data : o) as Record<string, unknown>;
  const object =
    data.object && typeof data.object === "object" ? (data.object as Record<string, unknown>) : data;

  const reportId =
    typeof object.id === "string"
      ? object.id
      : typeof data.id === "string"
        ? data.id
        : undefined;
  const candidateId =
    typeof object.candidate_id === "string"
      ? object.candidate_id
      : typeof data.candidate_id === "string"
        ? data.candidate_id
        : undefined;

  const externalTrainerId =
    typeof object.package === "string" && object.package.startsWith("mf_trainer:")
      ? object.package.slice("mf_trainer:".length)
      : typeof object.metadata === "object" && object.metadata && typeof (object.metadata as Record<string, unknown>).trainerId === "string"
        ? String((object.metadata as Record<string, unknown>).trainerId)
        : typeof data.metadata === "object" &&
            data.metadata &&
            typeof (data.metadata as Record<string, unknown>).trainerId === "string"
          ? String((data.metadata as Record<string, unknown>).trainerId)
          : undefined;

  let vendorPaidCents = 0;
  const priceCandidates = [
    object.price,
    object.amount,
    object.total,
    data.price,
    data.amount,
  ];
  for (const p of priceCandidates) {
    if (typeof p === "number" && p > 0) {
      vendorPaidCents = p >= 100 ? Math.round(p) : Math.round(p * 100);
      break;
    }
    if (typeof p === "string" && /^\d+(\.\d+)?$/.test(p.trim())) {
      const v = Number.parseFloat(p);
      vendorPaidCents = v >= 100 ? Math.round(v) : Math.round(v * 100);
      break;
    }
  }
  if (vendorPaidCents <= 0) return null;

  const status = String(object.status ?? data.status ?? "").toLowerCase();
  const type = String(o.type ?? o.event ?? "").toLowerCase();
  const complete =
    status === "complete" ||
    status === "completed" ||
    status === "clear" ||
    type.includes("complete") ||
    type.includes("paid");
  if (!complete && type && !type.includes("report")) return null;

  return { reportId, candidateId, vendorPaidCents, externalTrainerId };
}
