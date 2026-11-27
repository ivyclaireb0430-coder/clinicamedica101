import { describe, expect, it } from "vitest";
import { hashResetToken, isTokenUsable, newResetToken, resetEmailText } from "../src/lib/password-reset";

describe("password reset links", () => {
  it("stores only a hash of a long random token", () => {
    const a = newResetToken();
    const b = newResetToken();
    expect(a.token.length).toBeGreaterThanOrEqual(40);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashResetToken(a.token));
    expect(a.tokenHash).not.toContain(a.token);
  });

  it("rejects used, expired or missing tokens", () => {
    const now = new Date("2026-11-27T10:00:00Z");
    const later = new Date("2026-11-27T10:10:00Z");
    expect(isTokenUsable({ expiresAt: later, usedAt: null }, now)).toBe(true);
    expect(isTokenUsable({ expiresAt: later, usedAt: now }, now)).toBe(false);
    expect(isTokenUsable({ expiresAt: now, usedAt: null }, later)).toBe(false);
    expect(isTokenUsable(null, now)).toBe(false);
  });

  it("emails the link with no health information", () => {
    const text = resetEmailText("Dr. Cruz", "https://app.example.org/login/reset?token=abc");
    expect(text).toContain("https://app.example.org/login/reset?token=abc");
    expect(text).toContain("30 minuto");
  });
});
