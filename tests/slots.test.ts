import { describe, expect, it } from "vitest";
import { openSlots } from "@/lib/slots";
import { manilaToUtc, manilaTimeString } from "@/lib/time";

const rules = [{ weekday: 1, startTime: "10:00", endTime: "12:00" }]; // Mondays
const monday = "2026-11-02";
const longAgo = new Date("2026-01-01T00:00:00Z");

describe("openSlots", () => {
  it("lists slots on the grid inside clinic hours", () => {
    const slots = openSlots({ date: monday, durationMin: 60, rules, blockedDates: [], busy: [], now: longAgo });
    expect(slots.map((s) => manilaTimeString(s.startAt))).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("returns nothing on a day without hours or a blocked date", () => {
    expect(openSlots({ date: "2026-11-03", durationMin: 30, rules, blockedDates: [], busy: [], now: longAgo })).toEqual([]);
    expect(openSlots({ date: monday, durationMin: 30, rules, blockedDates: [monday], busy: [], now: longAgo })).toEqual([]);
  });

  it("skips slots overlapping appointments or Google busy time", () => {
    const busy = [{ startAt: manilaToUtc(monday, "10:30"), endAt: manilaToUtc(monday, "11:00") }];
    const slots = openSlots({ date: monday, durationMin: 30, rules, blockedDates: [], busy, now: longAgo });
    expect(slots.map((s) => manilaTimeString(s.startAt))).toEqual(["10:00", "11:00", "11:30"]);
  });

  it("respects minimum notice from now", () => {
    const now = manilaToUtc(monday, "10:10");
    const slots = openSlots({ date: monday, durationMin: 30, rules, blockedDates: [], busy: [], now, minNoticeMin: 60 });
    expect(slots.map((s) => manilaTimeString(s.startAt))).toEqual(["11:30"]);
  });
});
