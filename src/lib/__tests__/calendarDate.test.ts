import { afterAll, describe, expect, it } from "vitest";
import {
  calendarDateKey,
  calendarDateToLocal,
  formatCalendarDate,
  isCalendarDateBeforeToday,
  todayKey,
} from "@/lib/calendarDate";
import { isOverdue } from "@/lib/dueDate";

// Node re-reads TZ whenever it changes, so each case can pin a zone.
const originalTz = process.env.TZ;
afterAll(() => {
  process.env.TZ = originalTz;
});

// What the app stores for a date picked as 2026-09-22.
const STORED = new Date("2026-09-22");

const ZONES = ["Pacific/Pago_Pago", "America/Los_Angeles", "UTC", "Asia/Tokyo", "Pacific/Kiritimati"];

describe.each(ZONES)("calendar dates in %s", (zone) => {
  it("show the picked day, not the day before or after", () => {
    process.env.TZ = zone;
    expect(formatCalendarDate(STORED, "MMM d, yyyy")).toBe("Sep 22, 2026");
    expect(formatCalendarDate("2026-09-22", "MMM d")).toBe("Sep 22");
    expect(formatCalendarDate(STORED.toISOString(), "MMM d")).toBe("Sep 22");
  });

  it("round-trip through the date input unchanged", () => {
    process.env.TZ = zone;
    expect(calendarDateKey(STORED)).toBe("2026-09-22");
    expect(calendarDateKey(new Date(calendarDateKey(STORED)))).toBe("2026-09-22");
  });

  it("give local midnight of that day for date math", () => {
    process.env.TZ = zone;
    const local = calendarDateToLocal(STORED)!;
    expect([local.getFullYear(), local.getMonth(), local.getDate(), local.getHours()]).toEqual([
      2026, 8, 22, 0,
    ]);
  });
});

describe("overdue", () => {
  it("is not overdue at any point during the due day itself", () => {
    process.env.TZ = "America/Los_Angeles";
    // 8pm on Sep 22 in Los Angeles is already Sep 23 in UTC.
    const eveningOnDueDay = new Date("2026-09-23T03:00:00Z");
    expect(todayKey(eveningOnDueDay)).toBe("2026-09-22");
    expect(isOverdue(STORED, "TODO", ["DONE"], eveningOnDueDay)).toBe(false);

    process.env.TZ = "Asia/Tokyo";
    // 1am on Sep 22 in Tokyo is still Sep 21 in UTC.
    const earlyOnDueDay = new Date("2026-09-21T16:00:00Z");
    expect(isOverdue(STORED, "TODO", ["DONE"], earlyOnDueDay)).toBe(false);
  });

  it("becomes overdue once the due day has ended", () => {
    process.env.TZ = "America/Los_Angeles";
    const nextMorning = new Date("2026-09-23T16:00:00Z"); // 9am Sep 23 in LA
    expect(isOverdue(STORED, "TODO", ["DONE"], nextMorning)).toBe(true);
    expect(isOverdue(STORED, "DONE", ["DONE"], nextMorning)).toBe(false);
  });

  it("treats missing or invalid dates as not overdue", () => {
    expect(isCalendarDateBeforeToday(null)).toBe(false);
    expect(isCalendarDateBeforeToday("not a date")).toBe(false);
    expect(formatCalendarDate(undefined, "MMM d")).toBe("");
    expect(calendarDateKey("not a date")).toBe("");
  });
});
