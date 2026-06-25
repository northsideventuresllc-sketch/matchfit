import { describe, expect, it } from "vitest";
import {
  CONTENT_HUB_DELETE_RETENTION_HOURS,
  CONTENT_HUB_POSTED_RETENTION_HOURS,
} from "@/lib/content-calendar/constants";

describe("content calendar posted retention", () => {
  it("keeps posted and deleted retention aligned at 48 hours", () => {
    expect(CONTENT_HUB_POSTED_RETENTION_HOURS).toBe(48);
    expect(CONTENT_HUB_DELETE_RETENTION_HOURS).toBe(48);
  });
});
