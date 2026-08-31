import { describe, expect, it } from "vitest";
import {
  computeManualPostSchedule,
  describeEtMoment,
  describePendingPost,
  etTimeLabel,
  MEDIA_BUILD_SLOTS_ET,
  nextEtSlotAfter,
  POSTING_SLOTS_ET,
} from "@/lib/content-calendar/pending-schedule";

/**
 * Reference clock instants. July/August 2026 is EDT (UTC-4).
 *   Mon 2026-07-27, Fri 2026-07-31, Sat 2026-08-01, Mon 2026-08-03.
 */
const FRI_6PM_ET = new Date("2026-07-31T22:00:00Z"); // Fri Jul 31, 6:00pm ET
const FRI_830PM_ET = new Date("2026-08-01T00:30:00Z"); // Fri Jul 31, 8:30pm ET
const SAT_10AM_ET = new Date("2026-08-01T14:00:00Z"); // Sat Aug 1, 10:00am ET

const staticPost = {
  postType: "Static",
  mediaStatus: "none",
  mediaUrls: [] as string[],
  scheduledAt: null,
};

describe("nextEtSlotAfter", () => {
  it("picks the 7:15pm media slot on a Friday evening before it has passed", () => {
    const slot = nextEtSlotAfter(MEDIA_BUILD_SLOTS_ET, FRI_6PM_ET);
    expect(slot.toISOString()).toBe("2026-07-31T23:15:00.000Z"); // Fri 7:15pm ET
    expect(etTimeLabel(slot)).toBe("7:15pm");
  });

  it("rolls Friday's missed slots to Monday morning rather than the weekend", () => {
    const slot = nextEtSlotAfter(MEDIA_BUILD_SLOTS_ET, FRI_830PM_ET);
    expect(slot.toISOString()).toBe("2026-08-03T12:30:00.000Z"); // Mon 8:30am ET
    expect(describeEtMoment(slot, FRI_830PM_ET)).toBe("Mon Aug 3 at 8:30am");
  });

  it("skips the weekend entirely from a Saturday", () => {
    const media = nextEtSlotAfter(MEDIA_BUILD_SLOTS_ET, SAT_10AM_ET);
    const posting = nextEtSlotAfter(POSTING_SLOTS_ET, SAT_10AM_ET);
    expect(media.toISOString()).toBe("2026-08-03T12:30:00.000Z"); // Mon 8:30am ET
    expect(posting.toISOString()).toBe("2026-08-03T21:00:00.000Z"); // Mon 5pm ET
  });
});

describe("describePendingPost — Friday evening", () => {
  it("says pictures build tonight at 7:15pm and it posts tonight at 8pm", () => {
    const view = describePendingPost(staticPost, FRI_6PM_ET);

    expect(view.mediaReady).toBe(false);
    expect(view.mediaLine).toBe("Pictures build tonight at 7:15pm.");
    // 8pm is the first posting window AFTER the 7:15pm build — never the already-passed 5pm one.
    expect(view.postLine).toBe("Posts tonight at 8pm.");
    expect(view.postAt.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(view.postTimeIsExact).toBe(false);
  });

  it("rolls to Monday once Friday's last slots have gone", () => {
    const view = describePendingPost(staticPost, FRI_830PM_ET);

    expect(view.mediaLine).toBe("Pictures build Mon Aug 3 at 8:30am.");
    expect(view.postLine).toBe("Posts Mon Aug 3 at 5pm.");
  });

  it("says the pictures are ready instead of showing a build time", () => {
    const view = describePendingPost(
      { ...staticPost, mediaStatus: "ready", mediaUrls: ["https://cdn.test/a.png"] },
      FRI_6PM_ET,
    );

    expect(view.mediaReady).toBe(true);
    expect(view.mediaLine).toBe("Pictures are ready and attached.");
    expect(view.mediaAt).toBeNull();
    // Nothing to wait for, so it takes the very next window — 8pm tonight.
    expect(view.postLine).toBe("Posts tonight at 8pm.");
  });

  it("treats a Text post as having nothing to build", () => {
    const view = describePendingPost({ ...staticPost, postType: "Text" }, FRI_6PM_ET);

    expect(view.mediaReady).toBe(true);
    expect(view.mediaLine).toBe("This one is words only — there is nothing to build.");
    expect(view.mediaBadge).toBe("Words only");
  });
});

describe("describePendingPost — weekend", () => {
  it("shows Monday's real date on both lines when asked on a Saturday", () => {
    const view = describePendingPost(staticPost, SAT_10AM_ET);

    expect(view.mediaLine).toBe("Pictures build Mon Aug 3 at 8:30am.");
    expect(view.postLine).toBe("Posts Mon Aug 3 at 5pm.");
    expect(view.mediaAt?.toISOString()).toBe("2026-08-03T12:30:00.000Z");
    expect(view.postAt.toISOString()).toBe("2026-08-03T21:00:00.000Z");
  });

  it("keeps an exact posting time JB picked, even over the weekend", () => {
    const view = describePendingPost(
      { ...staticPost, mediaStatus: "ready", scheduledAt: "2026-08-02T18:00:00Z" }, // Sun 2pm ET
      SAT_10AM_ET,
    );

    expect(view.postTimeIsExact).toBe(true);
    expect(view.postLine).toBe("Posts tomorrow, Sun Aug 2 at 2pm.");
  });

  it("ignores an exact posting time that has already gone by", () => {
    const view = describePendingPost(
      { ...staticPost, mediaStatus: "ready", scheduledAt: "2026-07-30T21:00:00Z" }, // Thu, in the past
      SAT_10AM_ET,
    );

    expect(view.postTimeIsExact).toBe(false);
    expect(view.postLine).toBe("Posts Mon Aug 3 at 5pm.");
  });
});

describe("describeEtMoment wording", () => {
  it("uses today-relative wording without a date, and dates everything else", () => {
    const monMorning = new Date("2026-07-27T12:00:00Z"); // Mon Jul 27, 8:00am ET
    expect(describeEtMoment(new Date("2026-07-27T12:30:00Z"), monMorning)).toBe("this morning at 8:30am");
    expect(describeEtMoment(new Date("2026-07-27T20:15:00Z"), monMorning)).toBe("this afternoon at 4:15pm");
    expect(describeEtMoment(new Date("2026-07-27T23:15:00Z"), monMorning)).toBe("tonight at 7:15pm");
    expect(describeEtMoment(new Date("2026-07-28T12:30:00Z"), monMorning)).toBe("tomorrow, Tue Jul 28 at 8:30am");
    expect(describeEtMoment(new Date("2026-07-29T12:30:00Z"), monMorning)).toBe("Wed Jul 29 at 8:30am");
  });

  it("holds the documented ET wall-clock times through the EST half of the year", () => {
    const janFriday = new Date("2027-01-08T16:00:00Z"); // Fri Jan 8 2027, 11:00am EST
    const media = nextEtSlotAfter(MEDIA_BUILD_SLOTS_ET, janFriday);
    expect(etTimeLabel(media)).toBe("4:15pm");
    expect(media.toISOString()).toBe("2027-01-08T21:15:00.000Z"); // 4:15pm EST = 21:15 UTC
  });
});

describe("computeManualPostSchedule", () => {
  it("lands 24 hours after 11:59pm ET of the post date, during EDT", () => {
    // Mon Jul 27 2026 11:59pm EDT = 2026-07-28T03:59:00Z; +24h = Tue 11:59pm EDT.
    expect(computeManualPostSchedule("2026-07-27").toISOString()).toBe("2026-07-29T03:59:00.000Z");
  });

  it("lands 24 hours after 11:59pm ET of the post date, during EST", () => {
    // Fri Jan 8 2027 11:59pm EST = 2027-01-09T04:59:00Z; +24h = Sat 11:59pm EST.
    expect(computeManualPostSchedule("2027-01-08").toISOString()).toBe("2027-01-10T04:59:00.000Z");
  });

  it("is a literal +24h UTC offset, so it shifts an hour of ET wall-clock across the DST fall-back", () => {
    // Sat Oct 31 2026 11:59pm EDT = 2026-11-01T03:59:00Z. Adding a literal 24h UTC crosses the
    // Nov 1 2am fall-back, so the result reads as Sun Nov 1 10:59pm EST — not 11:59pm.
    const result = computeManualPostSchedule("2026-10-31");
    expect(result.toISOString()).toBe("2026-11-02T03:59:00.000Z");
    expect(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(result),
    ).toBe("Nov 1, 2026, 10:59 PM");
  });
});
