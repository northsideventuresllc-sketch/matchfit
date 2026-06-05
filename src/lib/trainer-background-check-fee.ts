import { defaultBackgroundCheckVendorPaidCents } from "@/lib/checkr-config";

/** Amount charged for background screening (cents). Client-safe — no Prisma imports. */
export function trainerBackgroundCheckAmountCents(): number {
  const usd = process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD?.trim();
  if (usd) {
    const n = Number.parseFloat(usd);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100);
  }
  return defaultBackgroundCheckVendorPaidCents();
}
