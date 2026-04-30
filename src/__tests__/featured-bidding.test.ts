import { describe, expect, it } from "vitest";
import { minBidCentsToPlaceInTopTwo, sortBidsDesc, type BidRow } from "@/lib/featured-competition";

const t = (id: string, cents: number, ms: number): BidRow => ({
  trainerId: id,
  amountCents: cents,
  updatedAt: new Date(ms),
});

describe("sortBidsDesc", () => {
  it("orders by amount then earlier updatedAt", () => {
    const rows = [t("a", 100, 2000), t("b", 100, 1000), t("c", 50, 500)];
    const s = sortBidsDesc(rows).map((x) => x.trainerId);
    expect(s).toEqual(["b", "a", "c"]);
  });
});

describe("minBidCentsToPlaceInTopTwo", () => {
  it("returns floor when nobody else has bid", () => {
    const now = new Date();
    expect(minBidCentsToPlaceInTopTwo([], "me", now)).toBe(500);
  });

  it("uses the promotional floor when only one other bidder exists (two paid slots)", () => {
    const now = new Date(10_000);
    const bids = [t("other", 10_000, 1000)];
    expect(minBidCentsToPlaceInTopTwo(bids, "me", now)).toBe(500);
  });

  it("requires beating second place when two others exist", () => {
    const now = new Date(50_000);
    const bids = [t("a", 20_000, 1000), t("b", 15_000, 2000)];
    expect(minBidCentsToPlaceInTopTwo(bids, "me", now)).toBe(15_001);
  });
});
