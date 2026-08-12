import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createBrowserSignupProgressTransport,
  SignupProgressReporter,
  type SignupProgressTransport,
} from "@/lib/signup-progress-reporter";

function fakeTimers() {
  const pending = new Map<number, () => void>();
  let nextId = 1;
  const scheduleTimeout = vi.fn((cb: () => void) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  });
  const clearScheduledTimeout = vi.fn((handle: unknown) => {
    pending.delete(handle as number);
  });
  function fireAll() {
    const callbacks = [...pending.values()];
    pending.clear();
    for (const cb of callbacks) cb();
  }
  return { scheduleTimeout, clearScheduledTimeout, fireAll, pendingCount: () => pending.size };
}

function fakeTransport(): SignupProgressTransport & { calls: { url: string; body: string }[] } {
  const calls: { url: string; body: string }[] = [];
  return {
    calls,
    send(url: string, body: string) {
      calls.push({ url, body });
      return true;
    },
  };
}

describe("SignupProgressReporter", () => {
  let visitorId: string;

  beforeEach(() => {
    visitorId = "visitor_123";
  });

  it("does not send until the debounce timer fires", () => {
    const timers = fakeTimers();
    const transport = fakeTransport();
    const reporter = new SignupProgressReporter({
      role: "trainer",
      getVisitorId: () => visitorId,
      transport,
      scheduleTimeout: timers.scheduleTimeout,
      clearScheduledTimeout: timers.clearScheduledTimeout,
    });

    reporter.report({ firstName: true, email: true }, { email: "coach@example.com", username: "coachone" });
    expect(transport.calls).toHaveLength(0);

    timers.fireAll();
    expect(transport.calls).toHaveLength(1);
    expect(JSON.parse(transport.calls[0].body)).toEqual({
      role: "trainer",
      visitorId: "visitor_123",
      fields: { firstName: true, email: true },
      email: "coach@example.com",
      username: "coachone",
    });
  });

  it("collapses rapid reports into a single debounced send carrying the latest email", () => {
    const timers = fakeTimers();
    const transport = fakeTransport();
    const reporter = new SignupProgressReporter({
      role: "trainer",
      getVisitorId: () => visitorId,
      transport,
      scheduleTimeout: timers.scheduleTimeout,
      clearScheduledTimeout: timers.clearScheduledTimeout,
    });

    reporter.report({ email: true }, { email: "c" });
    reporter.report({ email: true }, { email: "co" });
    reporter.report({ email: true }, { email: "coach@example.com" });

    // Only the last timer should still be pending — the first two were cancelled.
    expect(timers.pendingCount()).toBe(1);
    timers.fireAll();

    expect(transport.calls).toHaveLength(1);
    expect(JSON.parse(transport.calls[0].body).email).toBe("coach@example.com");
  });

  it("flush() sends the latest state immediately, bypassing the pending debounce — this is the fix for the abandonment race where a closed tab kills the pending timer/fetch before it ever fires", () => {
    const timers = fakeTimers();
    const transport = fakeTransport();
    const reporter = new SignupProgressReporter({
      role: "trainer",
      getVisitorId: () => visitorId,
      transport,
      scheduleTimeout: timers.scheduleTimeout,
      clearScheduledTimeout: timers.clearScheduledTimeout,
    });

    reporter.report({ firstName: true, email: true }, { email: "abandoning-visitor@example.com" });
    // Simulate the tab closing before the 400ms debounce ever gets a chance to fire.
    reporter.flush();

    expect(transport.calls).toHaveLength(1);
    expect(JSON.parse(transport.calls[0].body).email).toBe("abandoning-visitor@example.com");

    // The debounce timer must have been cancelled by flush(), so firing any leftover timers
    // (there should be none) must not produce a second send.
    timers.fireAll();
    expect(transport.calls).toHaveLength(1);
  });

  it("flush() is a no-op when nothing has been reported yet", () => {
    const timers = fakeTimers();
    const transport = fakeTransport();
    const reporter = new SignupProgressReporter({
      role: "client",
      getVisitorId: () => visitorId,
      transport,
      scheduleTimeout: timers.scheduleTimeout,
      clearScheduledTimeout: timers.clearScheduledTimeout,
    });

    reporter.flush();
    expect(transport.calls).toHaveLength(0);
  });

  it("does not send (debounced or flushed) when there is no visitor id", () => {
    visitorId = "";
    const timers = fakeTimers();
    const transport = fakeTransport();
    const reporter = new SignupProgressReporter({
      role: "trainer",
      getVisitorId: () => visitorId,
      transport,
      scheduleTimeout: timers.scheduleTimeout,
      clearScheduledTimeout: timers.clearScheduledTimeout,
    });

    reporter.report({ email: true }, { email: "no-cookie@example.com" });
    timers.fireAll();
    reporter.flush();
    expect(transport.calls).toHaveLength(0);
  });

  it("de-dupes an identical flush() that follows a debounced send with nothing new to say", () => {
    const timers = fakeTimers();
    const transport = fakeTransport();
    const reporter = new SignupProgressReporter({
      role: "trainer",
      getVisitorId: () => visitorId,
      transport,
      scheduleTimeout: timers.scheduleTimeout,
      clearScheduledTimeout: timers.clearScheduledTimeout,
    });

    reporter.report({ email: true }, { email: "coach@example.com" });
    timers.fireAll();
    expect(transport.calls).toHaveLength(1);

    // pagehide fires moments later with no new field changes in between.
    reporter.flush();
    expect(transport.calls).toHaveLength(1);
  });

  it("sends fresh state again after a prior flush if the visitor keeps typing", () => {
    const timers = fakeTimers();
    const transport = fakeTransport();
    const reporter = new SignupProgressReporter({
      role: "trainer",
      getVisitorId: () => visitorId,
      transport,
      scheduleTimeout: timers.scheduleTimeout,
      clearScheduledTimeout: timers.clearScheduledTimeout,
    });

    reporter.report({ email: true }, { email: "coach@example.com" });
    reporter.flush();
    expect(transport.calls).toHaveLength(1);

    reporter.report({ email: true, password: true }, { email: "coach@example.com" });
    reporter.flush();
    expect(transport.calls).toHaveLength(2);
  });
});

describe("createBrowserSignupProgressTransport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers navigator.sendBeacon when available and accepts the payload", () => {
    const beacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon: beacon } as unknown as Navigator);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const transport = createBrowserSignupProgressTransport();
    const ok = transport.send("/api/public/signup-progress", '{"role":"trainer"}');

    expect(ok).toBe(true);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to fetch(..., { keepalive: true }) when sendBeacon is unavailable", () => {
    vi.stubGlobal("navigator", {} as unknown as Navigator);
    const fetchSpy = vi.fn(() => Promise.resolve({} as Response));
    vi.stubGlobal("fetch", fetchSpy);

    const transport = createBrowserSignupProgressTransport();
    const ok = transport.send("/api/public/signup-progress", '{"role":"trainer"}');

    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/public/signup-progress",
      expect.objectContaining({ method: "POST", keepalive: true, body: '{"role":"trainer"}' }),
    );
  });

  it("falls back to fetch when sendBeacon rejects the payload", () => {
    const beacon = vi.fn(() => false);
    vi.stubGlobal("navigator", { sendBeacon: beacon } as unknown as Navigator);
    const fetchSpy = vi.fn(() => Promise.resolve({} as Response));
    vi.stubGlobal("fetch", fetchSpy);

    const transport = createBrowserSignupProgressTransport();
    transport.send("/api/public/signup-progress", '{"role":"trainer"}');

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
