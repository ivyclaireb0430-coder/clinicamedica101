import { describe, expect, it } from "vitest";
import { followUpsSatisfiedBy, isStalled, recallAction, testimonialName } from "@/lib/followup";
import { manilaToUtc } from "@/lib/time";

const now = manilaToUtc("2026-10-28", "10:00");
const opts = { repeatDays: 7, maxCount: 3 };

describe("follow-up reminders", () => {
  it("sends the first reminder the day before or on the due date", () => {
    expect(recallAction({ dueDate: "2026-10-29", recallCount: 0, lastRecallAt: null }, now, opts)).toBe("DUE");
    expect(recallAction({ dueDate: "2026-10-28", recallCount: 0, lastRecallAt: null }, now, opts)).toBe("DUE");
    expect(recallAction({ dueDate: "2026-10-30", recallCount: 0, lastRecallAt: null }, now, opts)).toBeNull();
    expect(recallAction({ dueDate: "2026-10-29", recallCount: 1, lastRecallAt: now }, now, opts)).toBeNull();
  });
  it("repeats weekly when overdue, up to the limit", () => {
    const sixDaysAgo = new Date(now.getTime() - 6 * 86_400_000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 86_400_000);
    expect(recallAction({ dueDate: "2026-10-20", recallCount: 1, lastRecallAt: sixDaysAgo }, now, opts)).toBeNull();
    expect(recallAction({ dueDate: "2026-10-20", recallCount: 1, lastRecallAt: eightDaysAgo }, now, opts)).toBe("OVERDUE");
    expect(recallAction({ dueDate: "2026-10-27", recallCount: 0, lastRecallAt: null }, now, opts)).toBe("OVERDUE");
    expect(recallAction({ dueDate: "2026-09-01", recallCount: 3, lastRecallAt: eightDaysAgo }, now, opts)).toBeNull();
  });
  it("closes follow-ups a visit takes care of", () => {
    const open = [{ id: "a", dueDate: "2026-10-25" }, { id: "b", dueDate: "2026-11-04" }, { id: "c", dueDate: "2026-12-01" }];
    expect(followUpsSatisfiedBy(open, "2026-10-28").map((f) => f.id)).toEqual(["a", "b"]);
  });
  it("detects stalled plans", () => {
    expect(isStalled("2026-10-14", "2026-10-28", 14)).toBe(true);
    expect(isStalled("2026-10-15", "2026-10-28", 14)).toBe(false);
  });
  it("names testimonials the way the patient chose", () => {
    const p = { firstName: "Maria", lastName: "Santos" };
    expect(testimonialName(p, "FULL")).toBe("Maria Santos");
    expect(testimonialName(p, "INITIAL")).toBe("Maria S.");
    expect(testimonialName(p, "ANONYMOUS")).toBe("Anonymous patient");
  });
});
