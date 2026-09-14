import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for secrets/tokens supplied by a caller
 * (bearer tokens, internal shared secrets, webhook signatures, etc.).
 * Never compare a secret with `===`/`!==` — that leaks timing information
 * proportional to how many leading characters match, which lets an attacker
 * recover the secret byte-by-byte. See `src/lib/otp.ts` / `src/lib/checkr.ts`
 * for the same pattern applied to OTP hashes and HMAC signatures.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on mismatched lengths — the length check itself
  // leaks only the length, not the content, which is an acceptable and
  // standard trade-off (secrets here are fixed-format tokens, not passwords).
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
