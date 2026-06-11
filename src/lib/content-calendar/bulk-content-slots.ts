import {
  CONTENT_CALENDAR_GROUPS,
  CONTENT_CALENDAR_POST_TYPES,
  type ContentCalendarGroup,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { getContentCalendarRotation } from "@/lib/content-calendar/rotation";

export type BulkTypeCounts = Record<ContentCalendarPostType, number>;

export type BulkContentSlot = {
  id: string;
  postType: ContentCalendarPostType;
  label: string;
  indexWithinType: number;
};

export type BulkAssignmentMode = "randomize" | "default_schedule" | "ai_choice";

export const EMPTY_BULK_TYPE_COUNTS = (): BulkTypeCounts =>
  Object.fromEntries(CONTENT_CALENDAR_POST_TYPES.map((t) => [t, 0])) as BulkTypeCounts;

export function bulkTypeCountsTotal(counts: BulkTypeCounts): number {
  return CONTENT_CALENDAR_POST_TYPES.reduce((sum, type) => sum + (counts[type] ?? 0), 0);
}

export function buildBulkSlots(counts: BulkTypeCounts): BulkContentSlot[] {
  const slots: BulkContentSlot[] = [];
  for (const postType of CONTENT_CALENDAR_POST_TYPES) {
    const count = counts[postType] ?? 0;
    for (let i = 0; i < count; i++) {
      slots.push({
        id: `${postType.toLowerCase()}_${i + 1}`,
        postType,
        label: `${postType} #${i + 1}`,
        indexWithinType: i + 1,
      });
    }
  }
  return slots;
}

export function defaultAudienceForSlot(slot: BulkContentSlot, globalIndex: number, offset = 0): ContentCalendarGroup {
  const dayIndex = globalIndex % 5;
  const rot = getContentCalendarRotation(dayIndex, offset);
  return rot[slot.postType];
}

export function assignRandomAudiences(slots: BulkContentSlot[]): Record<string, ContentCalendarGroup> {
  const result: Record<string, ContentCalendarGroup> = {};
  for (const slot of slots) {
    const idx = Math.floor(Math.random() * CONTENT_CALENDAR_GROUPS.length);
    result[slot.id] = CONTENT_CALENDAR_GROUPS[idx];
  }
  return result;
}

export function assignDefaultScheduleAudiences(
  slots: BulkContentSlot[],
  offset = 0,
): Record<string, ContentCalendarGroup> {
  const result: Record<string, ContentCalendarGroup> = {};
  slots.forEach((slot, globalIndex) => {
    result[slot.id] = defaultAudienceForSlot(slot, globalIndex, offset);
  });
  return result;
}

export function initialAudienceMap(slots: BulkContentSlot[], offset = 0): Record<string, ContentCalendarGroup> {
  return assignDefaultScheduleAudiences(slots, offset);
}
