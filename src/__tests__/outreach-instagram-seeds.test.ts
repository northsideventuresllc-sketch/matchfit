import { describe, expect, it } from "vitest";
import {
  countAvailableInstagramSeeds,
  OUTREACH_INSTAGRAM_SEEDS,
  pickInstagramSeedLeads,
} from "@/lib/outreach-instagram-seeds";

describe("pickInstagramSeedLeads", () => {
  it("returns unused seeds by target group", () => {
    const picked = pickInstagramSeedLeads({
      atlCount: 1,
      virtualCount: 2,
      exclusions: [],
    });
    expect(picked).toHaveLength(3);
    expect(picked.filter((s) => s.targetGroup === "ATL_LOCAL")).toHaveLength(1);
    expect(picked.filter((s) => s.targetGroup === "VIRTUAL")).toHaveLength(2);
  });

  it("skips excluded handles", () => {
    const firstVirtual = OUTREACH_INSTAGRAM_SEEDS.find((s) => s.targetGroup === "VIRTUAL");
    expect(firstVirtual).toBeTruthy();
    const picked = pickInstagramSeedLeads({
      atlCount: 0,
      virtualCount: 5,
      exclusions: [firstVirtual!.handle, firstVirtual!.profileUrl],
    });
    expect(picked.some((s) => s.username === firstVirtual!.username)).toBe(false);
  });

  it("counts remaining seeds", () => {
    const available = countAvailableInstagramSeeds(["@blogilates"]);
    expect(available.virtual).toBe(
      OUTREACH_INSTAGRAM_SEEDS.filter((s) => s.targetGroup === "VIRTUAL").length - 1,
    );
  });
});
