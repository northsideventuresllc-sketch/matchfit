import { describe, expect, it, vi } from "vitest";
import { queuePromoTokensLoad } from "@/lib/trainer-promo-token-load";

describe("queuePromoTokensLoad", () => {
  it("defers load execution to the provided scheduler callback", () => {
    const load = vi.fn();
    let scheduledCallback: (() => void) | null = null;
    const scheduler = vi.fn((callback: () => void) => {
      scheduledCallback = callback;
    });

    queuePromoTokensLoad(load, scheduler);

    expect(scheduler).toHaveBeenCalledTimes(1);
    expect(load).not.toHaveBeenCalled();

    expect(scheduledCallback).not.toBeNull();
    scheduledCallback?.();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("runs asynchronously with the default microtask scheduler", async () => {
    const load = vi.fn();

    queuePromoTokensLoad(load);
    expect(load).not.toHaveBeenCalled();

    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("supports synchronous schedulers used in tests and non-browser runtimes", () => {
    const load = vi.fn();
    const scheduler = vi.fn((callback: () => void) => {
      callback();
    });

    queuePromoTokensLoad(load, scheduler);

    expect(scheduler).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("schedules each invocation independently", () => {
    const load = vi.fn();
    const callbacks: Array<() => void> = [];

    queuePromoTokensLoad(load, (callback) => {
      callbacks.push(callback);
    });
    queuePromoTokensLoad(load, (callback) => {
      callbacks.push(callback);
    });

    expect(callbacks).toHaveLength(2);
    expect(load).not.toHaveBeenCalled();

    callbacks[0]?.();
    callbacks[1]?.();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
