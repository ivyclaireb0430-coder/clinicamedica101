import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
const { dueReminderKinds } = await import("@/lib/reminders");

const at = (iso: string) => new Date(iso);

describe("reminder timing", () => {
  const appt = { startAt: at("2026-11-05T02:00:00Z"), createdAt: at("2026-11-01T02:00:00Z"), status: "BOOKED" }; // Thu 10:00 Manila

  it("sends the confirmation right away in the daytime", () => {
    expect(dueReminderKinds(appt, [], at("2026-11-01T03:00:00Z"))).toEqual(["CONFIRMATION"]);
  });
  it("holds confirmations at night", () => {
    expect(dueReminderKinds(appt, [], at("2026-11-01T15:00:00Z"))).toEqual([]); // 23:00 Manila
  });
  it("sends the day-before reminder the previous day", () => {
    expect(dueReminderKinds(appt, ["CONFIRMATION"], at("2026-11-04T02:00:00Z"))).toEqual(["DAY_BEFORE"]);
  });
  it("sends the day-of reminder that morning", () => {
    expect(dueReminderKinds(appt, ["CONFIRMATION", "DAY_BEFORE"], at("2026-11-04T23:30:00Z"))).toEqual(["DAY_OF"]); // 07:30 Manila
  });
  it("sends nothing for cancelled or past appointments, or twice", () => {
    expect(dueReminderKinds({ ...appt, status: "CANCELLED" }, [], at("2026-11-04T02:00:00Z"))).toEqual([]);
    expect(dueReminderKinds(appt, [], at("2026-11-06T02:00:00Z"))).toEqual([]);
    expect(dueReminderKinds(appt, ["CONFIRMATION", "DAY_BEFORE"], at("2026-11-04T03:00:00Z"))).toEqual([]);
  });
  it("skips the day-before reminder for last-minute bookings", () => {
    const late = { ...appt, createdAt: at("2026-11-04T01:00:00Z") };
    expect(dueReminderKinds(late, ["CONFIRMATION"], at("2026-11-04T03:00:00Z"))).toEqual([]);
  });
});
