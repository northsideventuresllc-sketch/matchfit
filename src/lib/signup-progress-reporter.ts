/**
 * Pure, framework-agnostic core for reporting anonymous signup-wizard progress to
 * `/api/public/signup-progress`. Split out of `use-signup-progress-report.ts` so the
 * debounce + "don't lose the last value on abandonment" logic can be unit tested without
 * a React renderer (this repo's test suite is pure-logic, no jsdom/testing-library).
 *
 * Why this exists: the original implementation only ever sent progress on a 400ms debounced
 * `fetch()`. For a visitor who finishes typing and then immediately closes the tab (the exact
 * "abandoned signup" case this whole feature exists to catch), that is a race the visitor
 * always loses — the browser can drop a pending `setTimeout` and abort an in-flight `fetch`
 * on unload, so the last-typed email is silently never recorded even though every layer of
 * the write path (this file's `sendLatest`, the API route, `upsertSignupFormProgress`) is
 * individually correct. `flush()` exists to be called from `pagehide` / `visibilitychange`
 * so the last known state is force-sent through a transport designed to survive unload.
 */

export type SignupProgressRole = "client" | "trainer";
export type SignupProgressFields = Record<string, boolean>;
export type SignupProgressMeta = { email?: string | null; username?: string | null };

export interface SignupProgressTransport {
  /** Best-effort send. Return true if the transport accepted the payload (queued or sent). */
  send(url: string, body: string): boolean;
}

/**
 * Default browser transport: `navigator.sendBeacon` first (guaranteed by spec to survive page
 * unload), falling back to `fetch` with `keepalive: true` (also unload-safe, wider payload/
 * header support) when `sendBeacon` is unavailable or refuses the payload.
 */
export function createBrowserSignupProgressTransport(): SignupProgressTransport {
  return {
    send(url: string, body: string): boolean {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        try {
          const blob = new Blob([body], { type: "application/json" });
          if (navigator.sendBeacon(url, blob)) return true;
        } catch {
          // fall through to fetch
        }
      }
      if (typeof fetch === "function") {
        void fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
        return true;
      }
      return false;
    },
  };
}

export type SignupProgressReporterOptions = {
  role: SignupProgressRole;
  getVisitorId: () => string;
  transport?: SignupProgressTransport;
  url?: string;
  delayMs?: number;
  scheduleTimeout?: (cb: () => void, ms: number) => unknown;
  clearScheduledTimeout?: (handle: unknown) => void;
};

export class SignupProgressReporter {
  private readonly role: SignupProgressRole;
  private readonly getVisitorId: () => string;
  private readonly transport: SignupProgressTransport;
  private readonly url: string;
  private readonly delayMs: number;
  private readonly scheduleTimeout: (cb: () => void, ms: number) => unknown;
  private readonly clearScheduledTimeout: (handle: unknown) => void;

  private timerHandle: unknown = null;
  private latest: { fields: SignupProgressFields; meta?: SignupProgressMeta } | null = null;
  private lastSentBody: string | null = null;

  constructor(opts: SignupProgressReporterOptions) {
    this.role = opts.role;
    this.getVisitorId = opts.getVisitorId;
    this.transport = opts.transport ?? createBrowserSignupProgressTransport();
    this.url = opts.url ?? "/api/public/signup-progress";
    this.delayMs = opts.delayMs ?? 400;
    this.scheduleTimeout = opts.scheduleTimeout ?? ((cb, ms) => setTimeout(cb, ms));
    this.clearScheduledTimeout = opts.clearScheduledTimeout ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /** Debounced report — call on every field change. */
  report(fields: SignupProgressFields, meta?: SignupProgressMeta): void {
    this.latest = { fields, meta };
    if (this.timerHandle !== null) {
      this.clearScheduledTimeout(this.timerHandle);
      this.timerHandle = null;
    }
    this.timerHandle = this.scheduleTimeout(() => {
      this.timerHandle = null;
      this.sendLatest();
    }, this.delayMs);
  }

  /**
   * Immediately send the latest reported state, bypassing the debounce. Safe to call with
   * nothing pending (no-op) and safe to call repeatedly (de-dupes identical payloads so a
   * `pagehide` firing moments after the debounce already landed does not double-send).
   */
  flush(): void {
    if (this.timerHandle !== null) {
      this.clearScheduledTimeout(this.timerHandle);
      this.timerHandle = null;
    }
    this.sendLatest();
  }

  private sendLatest(): void {
    if (!this.latest) return;
    const visitorId = this.getVisitorId().trim();
    if (!visitorId) return;
    const body = JSON.stringify({
      role: this.role,
      visitorId,
      fields: this.latest.fields,
      ...this.latest.meta,
    });
    if (body === this.lastSentBody) return;
    if (this.transport.send(this.url, body)) {
      this.lastSentBody = body;
    }
  }
}
