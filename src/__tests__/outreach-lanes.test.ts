import { describe, expect, it } from "vitest";
import {
  followUpReminderDue,
  isEstHour,
  isPastDueForToday,
  nextDispatchSlot,
  startOfEstDayUtc,
} from "@/lib/outreach-lanes";

describe("isEstHour — dual-cron DST guard (OUT-LEAD-FINDER-DST-GUARD)", () => {
  it("is true at 8am ET during EDT (12:00 UTC)", () => {
    expect(isEstHour(8, new Date("2026-07-23T12:00:00Z"))).toBe(true);
  });

  it("is false at 9am ET during EDT (13:00 UTC) — the EST-correct fire is a no-op in summer", () => {
    expect(isEstHour(8, new Date("2026-07-23T13:00:00Z"))).toBe(false);
  });

  it("is true at 8am ET during EST (13:00 UTC)", () => {
    expect(isEstHour(8, new Date("2026-01-15T13:00:00Z"))).toBe(true);
  });

  it("is false at 7am ET during EST (12:00 UTC) — the EDT-correct fire is a no-op in winter", () => {
    expect(isEstHour(8, new Date("2026-01-15T12:00:00Z"))).toBe(false);
  });
});

describe("nextDispatchSlot (America/New_York, EDT/UTC-4 in July)", () => {
  it("before 1pm ET → 1pm today", () => {
    // 2026-07-23T15:00Z == 11:00 ET
    const r = nextDispatchSlot(new Date("2026-07-23T15:00:00Z"));
    expect(r.slot).toBe("13:00");
    expect(r.scheduledFor.toISOString()).toBe("2026-07-23T17:00:00.000Z"); // 1pm EDT
  });

  it("between 1pm and 4pm ET → 4pm today", () => {
    // 2026-07-23T18:00Z == 14:00 ET
    const r = nextDispatchSlot(new Date("2026-07-23T18:00:00Z"));
    expect(r.slot).toBe("16:00");
    expect(r.scheduledFor.toISOString()).toBe("2026-07-23T20:00:00.000Z"); // 4pm EDT
  });

  it("after 4pm ET → 1pm next day", () => {
    // 2026-07-23T21:00Z == 17:00 ET
    const r = nextDispatchSlot(new Date("2026-07-23T21:00:00Z"));
    expect(r.slot).toBe("13:00");
    expect(r.scheduledFor.toISOString()).toBe("2026-07-24T17:00:00.000Z"); // 1pm EDT next day
  });
});

describe("startOfEstDayUtc", () => {
  it("resolves midnight ET as the correct UTC instant (EDT)", () => {
    // 2026-07-23 midnight ET == 04:00Z
    expect(startOfEstDayUtc(new Date("2026-07-23T18:00:00Z")).toISOString()).toBe(
      "2026-07-23T04:00:00.000Z",
    );
  });
});

describe("isPastDueForToday", () => {
  const now = new Date("2026-07-23T16:00:00Z"); // 12:00 ET
  it("is past due when queued for an earlier ET calendar day", () => {
    expect(isPastDueForToday(new Date("2026-07-22T13:00:00Z"), now)).toBe(true);
  });
  it("is not past due when queued for today", () => {
    expect(isPastDueForToday(new Date("2026-07-23T05:00:00Z"), now)).toBe(false);
  });
  it("is not past due when queuedForDate is null", () => {
    expect(isPastDueForToday(null, now)).toBe(false);
  });
});

describe("followUpReminderDue", () => {
  const now = new Date("2026-07-23T12:00:00Z");
  const intervalHours = 24;

  it("fires when due and never reminded", () => {
    expect(
      followUpReminderDue({ dueAt: new Date("2026-07-23T10:00:00Z"), lastRemindedAt: null, now, intervalHours }),
    ).toBe(true);
  });
  it("does not fire before the due time", () => {
    expect(
      followUpReminderDue({ dueAt: new Date("2026-07-24T00:00:00Z"), lastRemindedAt: null, now, intervalHours }),
    ).toBe(false);
  });
  it("does not fire when reminded within the interval", () => {
    expect(
      followUpReminderDue({
        dueAt: new Date("2026-07-20T00:00:00Z"),
        lastRemindedAt: new Date("2026-07-23T00:00:00Z"), // 12h ago
        now,
        intervalHours,
      }),
    ).toBe(false);
  });
  it("re-fires once the interval has elapsed", () => {
    expect(
      followUpReminderDue({
        dueAt: new Date("2026-07-20T00:00:00Z"),
        lastRemindedAt: new Date("2026-07-22T11:00:00Z"), // 25h ago
        now,
        intervalHours,
      }),
    ).toBe(true);
  });
  it("never fires without a due time", () => {
    expect(followUpReminderDue({ dueAt: null, lastRemindedAt: null, now, intervalHours })).toBe(false);
  });
});
