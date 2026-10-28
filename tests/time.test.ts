import { describe, expect, it } from "vitest";
import { addDays, manilaDateString, manilaToUtc, startOfWeek, weekdayOf } from "@/lib/time";

describe("Manila time helpers", () => {
  it("converts Manila wall time to UTC (+8)", () => {
    expect(manilaToUtc("2026-11-02", "09:00").toISOString()).toBe("2026-11-02T01:00:00.000Z");
  });
  it("uses the Manila date, not the UTC date", () => {
    expect(manilaDateString(new Date("2026-11-01T17:30:00Z"))).toBe("2026-11-02");
  });
  it("computes weekdays and week starts", () => {
    expect(weekdayOf("2026-11-02")).toBe(1);
    expect(startOfWeek("2026-11-08")).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
