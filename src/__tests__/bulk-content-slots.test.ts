import { describe, expect, it } from "vitest";
import {
  assignDefaultScheduleAudiences,
  buildBulkSlots,
  bulkTypeCountsTotal,
  defaultAudienceForSlot,
} from "@/lib/content-calendar/bulk-content-slots";

describe("bulk-content-slots", () => {
  it("builds labeled slots per content type", () => {
    const slots = buildBulkSlots({ Video: 2, Static: 1, Carousel: 0, Text: 1 });
    expect(slots.map((s) => s.label)).toEqual(["Static #1", "Video #1", "Video #2", "Text #1"]);
    expect(bulkTypeCountsTotal({ Video: 2, Static: 1, Carousel: 0, Text: 1 })).toBe(4);
  });

  it("assigns default schedule audiences from rotation", () => {
    const slots = buildBulkSlots({ Video: 1, Static: 1, Carousel: 1, Text: 1 });
    const assigned = assignDefaultScheduleAudiences(slots);
    expect(assigned[slots[0].id]).toBe(defaultAudienceForSlot(slots[0], 0));
    expect(assigned[slots[1].id]).toBe(defaultAudienceForSlot(slots[1], 1));
  });
});
