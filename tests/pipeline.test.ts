import { describe, expect, it } from "vitest";
import { needsFollowUp, validateStageChange } from "@/lib/pipeline";
import { renderScript, placeholdersIn } from "@/lib/scripts";
import { verifyTotp, newTotpSecret } from "@/lib/totp";
import { authenticator } from "otplib";

describe("pipeline", () => {
  it("requires a reason when marking lost", () => {
    expect(validateStageChange("LOST", "").ok).toBe(false);
    expect(validateStageChange("LOST", "Price / budget").ok).toBe(true);
    expect(validateStageChange("NOPE").ok).toBe(false);
  });
  it("flags stale pre-booking leads for follow-up", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    const old = new Date("2026-11-05T00:00:00Z");
    expect(needsFollowUp({ stage: "REPLIED", lastContactAt: old }, 3, now)).toBe(true);
    expect(needsFollowUp({ stage: "BOOKED", lastContactAt: old }, 3, now)).toBe(false);
    expect(needsFollowUp({ stage: "NEW", lastContactAt: new Date("2026-11-09T00:00:00Z") }, 3, now)).toBe(false);
  });
});

describe("scripts", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(renderScript("Hi {first_name}! {date} {time} {fee}", { first_name: "Ana", date: "Nov 3", time: "10:00 AM" }))
      .toBe("Hi Ana! Nov 3 10:00 AM {fee}");
    expect(placeholdersIn("{a} {b} {a}")).toEqual(["a", "b"]);
  });
});

describe("TOTP", () => {
  it("accepts the current code and rejects junk", () => {
    const secret = newTotpSecret();
    expect(verifyTotp(authenticator.generate(secret), secret)).toBe(true);
    expect(verifyTotp("000000x", secret)).toBe(false);
  });
});
