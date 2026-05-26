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
});
