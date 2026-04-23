import { createHmac, randomInt, timingSafeEqual } from "crypto";

function secretKey(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) {
    return s;
  }
  if (process.env.NODE_ENV === "development") {
    return "dev-only-auth-secret-32chars-min!!";
  }
  throw new Error("AUTH_SECRET must be set to at least 32 characters for OTP security.");
}

export function generateSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(code: string): string {
  return createHmac("sha256", secretKey()).update(code).digest("hex");
}

export function verifyOtp(code: string, hash: string): boolean {
  try {
    const a = Buffer.from(hashOtp(code), "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
