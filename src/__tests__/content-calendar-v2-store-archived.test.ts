import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateNiBrainClient } = vi.hoisted(() => ({
  mockCreateNiBrainClient: vi.fn(),
}));

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: mockCreateNiBrainClient,
}));

import { listV2Posts } from "@/lib/content-calendar/content-calendar-v2-store";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listV2Posts({ stage: 'archived' })", () => {
  it("returns posted-then-archived rows and does NOT filter posted=false", async () => {
    const eqCalls: [string, unknown][] = [];
    const archivedRows = [
      { id: "post_1", workflow_stage: "archived", posted: true, archive_type: "posted" },
      { id: "post_2", workflow_stage: "archived", posted: false, archive_type: "scrapped" },
    ];

    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      not: () => builder,
      lte: () => Promise.resolve({ data: [], error: null }), // purgeExpiredV2Posts terminal
      eq: (col: string, val: unknown) => {
        eqCalls.push([col, val]);
        return builder;
      },
      is: () => builder,
      order: () => Promise.resolve({ data: archivedRows, error: null }), // listV2Posts terminal
    });

    mockCreateNiBrainClient.mockReturnValue({ from: () => builder });

    const rows = await listV2Posts({ stage: "archived" });

    expect(rows.map((r) => r.id)).toEqual(["post_1", "post_2"]);
    expect(eqCalls).toContainEqual(["workflow_stage", "archived"]);
    // The posted archived row would vanish if the archived stage still filtered posted=false.
    expect(eqCalls).not.toContainEqual(["posted", false]);
  });
});
