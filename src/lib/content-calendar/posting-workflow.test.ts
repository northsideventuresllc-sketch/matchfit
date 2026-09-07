import { describe, expect, it } from "vitest";

import {
  loadMatchFitVentureBlock,
  partitionByApproval,
  planRequiresEmulator,
  resolvePlatformWorkflow,
} from "@/lib/content-calendar/posting-workflow";

const VALID_JSON = JSON.stringify({
  ventures: [
    { id: "some-other-venture", channels: { instagram: "@other" } },
    {
      id: "match-fit",
      channels: {
        instagram: "@theofficialmatchfit",
        tiktok: "@theofficialmatchfit",
        threads: "@theofficialmatchfit",
        facebook: "Match Fit Facebook Page",
      },
    },
  ],
});

describe("loadMatchFitVentureBlock", () => {
  it("returns the match-fit block when the file is valid and has channels", () => {
    const block = loadMatchFitVentureBlock(() => VALID_JSON);
    expect(block?.id).toBe("match-fit");
    expect(block?.channels.instagram).toBe("@theofficialmatchfit");
  });

  it("returns null when the file cannot be read", () => {
    const block = loadMatchFitVentureBlock(() => {
      throw new Error("ENOENT");
    });
    expect(block).toBeNull();
  });

  it("returns null on invalid JSON", () => {
    const block = loadMatchFitVentureBlock(() => "{not json");
    expect(block).toBeNull();
  });

  it("returns null when the match-fit block is absent", () => {
    const block = loadMatchFitVentureBlock(() => JSON.stringify({ ventures: [{ id: "other" }] }));
    expect(block).toBeNull();
  });

  it("returns null when match-fit has no channels (Decision #1767: never guess)", () => {
    const block = loadMatchFitVentureBlock(() =>
      JSON.stringify({ ventures: [{ id: "match-fit", channels: {} }] }),
    );
    expect(block).toBeNull();
  });
});

describe("resolvePlatformWorkflow", () => {
  it("routes Instagram through the emulator", () => {
    expect(resolvePlatformWorkflow("Instagram")).toBe("emulator");
    expect(resolvePlatformWorkflow("instagram")).toBe("emulator");
  });

  it("routes Threads, Facebook and TikTok through mini Chrome", () => {
    expect(resolvePlatformWorkflow("Threads")).toBe("mini_chrome");
    expect(resolvePlatformWorkflow("Facebook")).toBe("mini_chrome");
    expect(resolvePlatformWorkflow("TikTok")).toBe("mini_chrome");
  });
});

describe("planRequiresEmulator", () => {
  it("is true when Instagram is among the platforms", () => {
    expect(planRequiresEmulator(["Threads", "Instagram"])).toBe(true);
  });

  it("is false when no platform needs the emulator", () => {
    expect(planRequiresEmulator(["Threads", "Facebook", "TikTok"])).toBe(false);
  });
});

describe("partitionByApproval", () => {
  it("keeps rows with approved_at and skips rows without it, with a reason", () => {
    const { approved, skipped } = partitionByApproval([
      { id: "a", approved_at: "2026-01-01T00:00:00.000Z" },
      { id: "b", approved_at: null },
    ]);
    expect(approved.map((p) => p.id)).toEqual(["a"]);
    expect(skipped).toEqual([{ id: "b", reason: expect.stringContaining("not approved") }]);
  });
});
