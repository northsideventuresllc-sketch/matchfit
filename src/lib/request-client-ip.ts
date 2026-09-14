/**
 * `x-forwarded-for` is a hop-by-hop chain: a caller can set their own value on
 * the request they send us, which lands at the FRONT of the chain. The entry
 * we can actually trust is the one appended by the last hop before us (this
 * app's own host platform), which is the END of the chain — so this reads the
 * last entry, never the first, to avoid a caller trivially rotating a fake
 * value to dodge IP-based rate limiting.
 */
export function getRequestClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const parts = xf.split(",").map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
