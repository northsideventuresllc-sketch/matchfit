import {
  CONTENT_CALENDAR_GROUPS,
  CONTENT_CALENDAR_POST_TYPES,
  type ContentCalendarGroup,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";

/** Baseline: Carousel→ATL Trainers · Static→Virtual Trainers · Video→ATL Clients · Text→Virtual Clients */
export function getContentCalendarRotation(
  dayIndex: number,
  offset: number,
): Record<ContentCalendarPostType, ContentCalendarGroup> {
  const result = {} as Record<ContentCalendarPostType, ContentCalendarGroup>;
  CONTENT_CALENDAR_POST_TYPES.forEach((type, i) => {
    result[type] = CONTENT_CALENDAR_GROUPS[(i + offset + dayIndex) % 4];
  });
  return result;
}

export function getMondayOfWeek(from = new Date()): Date {
  const today = new Date(from);
  const day = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

export function formatCalendarDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shortCalendarDate(base: Date, dayIndex: number): string {
  const d = new Date(base);
  d.setDate(base.getDate() + dayIndex);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function addWeekdays(baseMonday: Date, dayIndex: number): Date {
  const d = new Date(baseMonday);
  d.setDate(baseMonday.getDate() + dayIndex);
  d.setHours(0, 0, 0, 0);
  return d;
}
