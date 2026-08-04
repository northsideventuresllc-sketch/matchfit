import { describe, expect, it } from "vitest";

import {
  CONTENT_CALENDAR_BLOCKED_STATUS,
  insertGeneratedCalendarRow,
  isValidPostGroup,
  resolvePostGroup,
} from "@/lib/content-calendar/post-group";

describe("resolvePostGroup", () => {
  it("reproduces the live 2026-08-03 week grouping", () => {
    // Verified against NI-Brain match_fit_content_calendar_posts on 2026-08-04.
    expect(resolvePostGroup({ weekStart: "2026-08-03", dayIndex: 0 })).toBe("5pm");
    expect(resolvePostGroup({ weekStart: "2026-08-03", dayIndex: 1 })).toBe("8pm");
    expect(resolvePostGroup({ weekStart: "2026-08-03", dayIndex: 2 })).toBe("5pm");
    expect(resolvePostGroup({ weekStart: "2026-08-03", dayIndex: 3 })).toBe("8pm");
    expect(resolvePostGroup({ weekStart: "2026-08-03", dayIndex: 4 })).toBe("5pm");
  });

  it("keeps alternating across the week boundary instead of restarting", () => {
    // 5 weekdays is odd, so the following week must start on the opposite slot.
    expect(resolvePostGroup({ weekStart: "2026-08-10", dayIndex: 0 })).toBe("8pm");
    expect(resolvePostGroup({ weekStart: "2026-08-10", dayIndex: 1 })).toBe("5pm");
    expect(resolvePostGroup({ weekStart: "2026-08-10", dayIndex: 2 })).toBe("8pm");
    expect(resolvePostGroup({ weekStart: "2026-08-10", dayIndex: 3 })).toBe("5pm");
  });

  it("works for weeks before the anchor (negative modulo)", () => {
    expect(resolvePostGroup({ weekStart: "2026-07-27", dayIndex: 0 })).toBe("8pm");
    expect(resolvePostGroup({ weekStart: "2026-07-20", dayIndex: 0 })).toBe("5pm");
  });

  it("never returns a value outside the DB check constraint", () => {
    for (let week = -60; week <= 60; week += 1) {
      const monday = new Date(Date.UTC(2026, 7, 3) + week * 7 * 24 * 60 * 60 * 1000);
      const weekStart = monday.toISOString().slice(0, 10);
      for (let dayIndex = 0; dayIndex <= 4; dayIndex += 1) {
        const group = resolvePostGroup({ weekStart, dayIndex });
        expect(isValidPostGroup(group)).toBe(true);
      }
    }
  });

  it("returns null rather than guessing on bad input", () => {
    expect(resolvePostGroup({ weekStart: "", dayIndex: 0 })).toBeNull();
    expect(resolvePostGroup({ weekStart: "not-a-date", dayIndex: 0 })).toBeNull();
    expect(resolvePostGroup({ weekStart: "2026-02-31", dayIndex: 0 })).toBeNull();
    expect(resolvePostGroup({ weekStart: "2026-08-03", dayIndex: 5 })).toBeNull();
    expect(resolvePostGroup({ weekStart: "2026-08-03", dayIndex: -1 })).toBeNull();
    expect(resolvePostGroup({ weekStart: "2026-08-03", dayIndex: 1.5 })).toBeNull();
  });
});

function stubClient() {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "row-1", ...row }, error: null }),
          }),
          then: (resolve: (v: { error: null }) => unknown) => resolve({ error: null }),
        };
      },
    }),
  };
  return { client, inserted };
}

describe("insertGeneratedCalendarRow", () => {
  it("stamps a valid post_group on every generated row", async () => {
    const { client, inserted } = stubClient();
    await insertGeneratedCalendarRow({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      row: { week_start: "2026-08-03", day_index: 1, caption: "hi" },
      weekStart: "2026-08-03",
      dayIndex: 1,
      source: "test",
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0].post_group).toBe("8pm");
    expect(inserted[0].status).toBeUndefined();
  });

  it("refuses to create a draft with a null post_group and writes a blocked row instead", async () => {
    const { client, inserted } = stubClient();
    await expect(
      insertGeneratedCalendarRow({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        row: { week_start: "nonsense", day_index: 9, caption: "hi", status: "draft" },
        weekStart: "nonsense",
        dayIndex: 9,
        source: "test",
      }),
    ).rejects.toThrow(/post_group could not be resolved/);

    expect(inserted).toHaveLength(1);
    const blocked = inserted[0];
    // The broken draft is never written; only an auditable blocked record is.
    expect(blocked.status).toBe(CONTENT_CALENDAR_BLOCKED_STATUS);
    expect(blocked.status).not.toBe("draft");
    expect(blocked.post_group).toBeNull();
    expect(String(blocked.scrap_reason)).toContain("day_index=9");
    expect(String(blocked.scrap_reason)).toContain("nonsense");
    // It must satisfy the DB constraints so the audit row actually lands.
    expect(blocked.day_index).toBe(0);
    expect(blocked.week_start).toBe("2026-08-03");
    // And it must be unreachable by posting/approval.
    expect(blocked.is_scheduled).toBe(false);
    expect(blocked.posted).toBe(false);
    expect(blocked.workflow_stage).toBe("archived");
  });
});
