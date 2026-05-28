import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentPath,
  getSessionId,
  getVisitorId,
  linkLabelFromAnchor,
  readCookie,
  sendEvent,
  shouldTrackPath,
  writeCookie,
} from "@/components/site-analytics-tracker";
import { SITE_ANALYTICS_SESSION_KEY, SITE_ANALYTICS_VISITOR_COOKIE } from "@/lib/site-analytics-shared";

const originalDocument = (globalThis as { document?: Document }).document;
const originalWindow = (globalThis as { window?: Window }).window;
const originalSessionStorage = (globalThis as { sessionStorage?: Storage }).sessionStorage;
const originalFetch = globalThis.fetch;

function restoreGlobal<K extends "document" | "window" | "sessionStorage">(
  key: K,
  value: (typeof globalThis)[K] | undefined,
) {
  if (typeof value === "undefined") {
    delete (globalThis as Record<string, unknown>)[key];
    return;
  }
  (globalThis as Record<string, unknown>)[key] = value;
}

function createCookieDocument(initialCookie = ""): Document {
  let cookie = initialCookie;
  return {
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      cookie = value;
    },
  } as unknown as Document;
}

function createSessionStorage(seed: Record<string, string> = {}, throwOnAccess = false): Storage {
  const store = new Map(Object.entries(seed));
  return {
    get length() {
      return store.size;
    },
    clear() {
      if (throwOnAccess) throw new Error("storage blocked");
      store.clear();
    },
    getItem(key: string) {
      if (throwOnAccess) throw new Error("storage blocked");
      return store.get(key) ?? null;
    },
    key(index: number) {
      if (throwOnAccess) throw new Error("storage blocked");
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      if (throwOnAccess) throw new Error("storage blocked");
      store.delete(key);
    },
    setItem(key: string, value: string) {
      if (throwOnAccess) throw new Error("storage blocked");
      store.set(key, value);
    },
  } as Storage;
}

function createAnchor(options: { ariaLabel?: string; text?: string; title?: string }): HTMLAnchorElement {
  const attrs = new Map<string, string>();
  if (typeof options.ariaLabel === "string") attrs.set("aria-label", options.ariaLabel);
  if (typeof options.title === "string") attrs.set("title", options.title);
  return {
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
    textContent: options.text ?? null,
  } as unknown as HTMLAnchorElement;
}

describe("site analytics tracker helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    restoreGlobal("document", createCookieDocument());
    restoreGlobal("window", {
      location: {
        protocol: "http:",
        origin: "http://localhost:3000",
      },
    } as unknown as Window);
    restoreGlobal("sessionStorage", createSessionStorage());
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
  });

  afterEach(() => {
    restoreGlobal("document", originalDocument);
    restoreGlobal("window", originalWindow);
    restoreGlobal("sessionStorage", originalSessionStorage);
    globalThis.fetch = originalFetch;
  });

  it("normalizes paths by ensuring a leading slash and stripping query/hash", () => {
    expect(currentPath("trainer/signup?from=hero#cta")).toBe("/trainer/signup");
    expect(currentPath("/client/login?next=%2Fdashboard")).toBe("/client/login");
  });

  it("tracks only public non-admin, non-api paths", () => {
    expect(shouldTrackPath("/")).toBe(true);
    expect(shouldTrackPath("/trainer/signup")).toBe(true);
    expect(shouldTrackPath("/admin/login")).toBe(false);
    expect(shouldTrackPath("/api/public/site-analytics")).toBe(false);
    expect(shouldTrackPath("trainer/signup")).toBe(false);
  });

  it("picks link labels in aria-label -> text -> title order", () => {
    expect(linkLabelFromAnchor(createAnchor({ ariaLabel: "  Hero CTA  ", text: "Join now" }))).toBe("Hero CTA");
    expect(linkLabelFromAnchor(createAnchor({ text: "  Join   now  " }))).toBe("Join now");
    expect(linkLabelFromAnchor(createAnchor({ title: "Fallback title" }))).toBe("Fallback title");
    expect(linkLabelFromAnchor(createAnchor({}))).toBeNull();
  });

  it("reads and writes cookies with encoding and secure attribute", () => {
    restoreGlobal("document", createCookieDocument(`foo=1; ${SITE_ANALYTICS_VISITOR_COOKIE}=hello%20world`));
    expect(readCookie(SITE_ANALYTICS_VISITOR_COOKIE)).toBe("hello world");
    expect(readCookie("missing")).toBeNull();

    restoreGlobal("window", {
      location: {
        protocol: "https:",
        origin: "https://matchfit.app",
      },
    } as unknown as Window);
    writeCookie(SITE_ANALYTICS_VISITOR_COOKIE, "value with spaces");
    const cookie = (globalThis as { document: Document }).document.cookie;
    expect(cookie).toContain(`${SITE_ANALYTICS_VISITOR_COOKIE}=value%20with%20spaces`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });

  it("reuses existing visitor/session IDs and creates replacements when needed", () => {
    restoreGlobal("document", createCookieDocument(`${SITE_ANALYTICS_VISITOR_COOKIE}=visitor12345678`));
    restoreGlobal("sessionStorage", createSessionStorage({ [SITE_ANALYTICS_SESSION_KEY]: "session12345678" }));

    expect(getVisitorId()).toBe("visitor12345678");
    expect(getSessionId()).toBe("session12345678");

    restoreGlobal("document", createCookieDocument(`${SITE_ANALYTICS_VISITOR_COOKIE}=short`));
    restoreGlobal("sessionStorage", createSessionStorage({ [SITE_ANALYTICS_SESSION_KEY]: "short" }));

    const visitor = getVisitorId();
    const session = getSessionId();
    expect(visitor.length).toBeGreaterThanOrEqual(8);
    expect(session.length).toBeGreaterThanOrEqual(8);
    expect((globalThis as { document: Document }).document.cookie).toContain(`${SITE_ANALYTICS_VISITOR_COOKIE}=`);
    expect((globalThis as { sessionStorage: Storage }).sessionStorage.getItem(SITE_ANALYTICS_SESSION_KEY)).toBe(session);
  });

  it("falls back to generated session IDs when sessionStorage access throws", () => {
    restoreGlobal("sessionStorage", createSessionStorage({}, true));
    const session = getSessionId();
    expect(session.length).toBeGreaterThanOrEqual(8);
  });

  it("sends analytics payloads with visitor/session IDs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    globalThis.fetch = fetchMock;
    restoreGlobal("document", createCookieDocument(`${SITE_ANALYTICS_VISITOR_COOKIE}=visitor12345678`));
    restoreGlobal("sessionStorage", createSessionStorage({ [SITE_ANALYTICS_SESSION_KEY]: "session12345678" }));

    await sendEvent({ kind: "PAGE_VIEW", path: "/client/login" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("POST");
    expect(options.keepalive).toBe(true);
    expect(options.credentials).toBe("same-origin");
    const body = JSON.parse(String(options.body)) as {
      kind: string;
      path: string;
      visitorId: string;
      sessionId: string;
    };
    expect(body).toMatchObject({
      kind: "PAGE_VIEW",
      path: "/client/login",
      visitorId: "visitor12345678",
      sessionId: "session12345678",
    });
  });

  it("swallows network failures from analytics sends", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(sendEvent({ kind: "PAGE_VIEW", path: "/" })).resolves.toBeUndefined();
  });
});
