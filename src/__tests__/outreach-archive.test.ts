import { describe, expect, it } from "vitest";
import {
  OUTREACH_ARCHIVE_RETENTION_DAYS,
  OUTREACH_DEAD_LEAD_ARCHIVE_HOURS,
} from "@/lib/outreach-types";

describe("outreach archive constants", () => {
  it("archives dead leads after 48 hours", () => {
    expect(OUTREACH_DEAD_LEAD_ARCHIVE_HOURS).toBe(48);
  });

  it("purges archived leads after 60 days per account", () => {
    expect(OUTREACH_ARCHIVE_RETENTION_DAYS).toBe(60);
  });
});
