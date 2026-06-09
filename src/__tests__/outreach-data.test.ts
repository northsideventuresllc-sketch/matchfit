import { describe, expect, it } from "vitest";
import { buildMassDeleteOutreachWhere } from "@/lib/outreach-data";

describe("buildMassDeleteOutreachWhere", () => {
  it("scopes delete-all to active leads only", () => {
    expect(buildMassDeleteOutreachWhere({ mode: "all" })).toEqual({ deletedAt: null });
  });

  it("scopes delete-batch to a generation batch", () => {
    expect(
      buildMassDeleteOutreachWhere({ mode: "batch", generationBatchId: "batch_123_admin" }),
    ).toEqual({
      deletedAt: null,
      generationBatchId: "batch_123_admin",
    });
  });

  it("scopes delete-ids to selected active leads", () => {
    expect(buildMassDeleteOutreachWhere({ mode: "ids", ids: ["a", "b"] })).toEqual({
      deletedAt: null,
      id: { in: ["a", "b"] },
    });
  });
});
