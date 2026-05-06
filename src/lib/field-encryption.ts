import crypto from "crypto";

const ALG = "aes-256-gcm" as const;
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

function encryptionKey32(): Buffer {
  const b64 = process.env.MATCHFIT_TOKEN_ENCRYPTION_KEY?.trim();
  if (b64) {
    const buf = Buffer.from(b64, "base64");
    if (buf.length !== 32) {
      throw new Error("MATCHFIT_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64).");
    }
    return buf;
  }
  const auth = process.env.AUTH_SECRET?.trim();
  if (!auth || auth.length < 32) {
    throw new Error(
      "Set MATCHFIT_TOKEN_ENCRYPTION_KEY (32 random bytes, base64) for OAuth token storage, or use a 32+ character AUTH_SECRET in development only.",
    );
  }
  return crypto.createHash("sha256").update(`${auth}:mf:at-rest:v1`).digest();
}

/** AES-256-GCM; output is base64(iv || ciphertext||tag). */
export function encryptUtf8(plaintext: string): string {
  const key = encryptionKey32();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv, { authTagLength: AUTH_TAG_LEN });
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64");
}

export function decryptUtf8(payloadB64: string): string | null {
  try {
    const key = encryptionKey32();
    const buf = Buffer.from(payloadB64, "base64");
    if (buf.length < IV_LEN + AUTH_TAG_LEN + 1) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(buf.length - AUTH_TAG_LEN);
    const data = buf.subarray(IV_LEN, buf.length - AUTH_TAG_LEN);
    const decipher = crypto.createDecipheriv(ALG, key, iv, { authTagLength: AUTH_TAG_LEN });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
