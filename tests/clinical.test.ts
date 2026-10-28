import { describe, expect, it, vi, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

vi.mock("@/lib/db", () => ({ db: {} }));
const { checkPlanTransition, formatPatientNo, intakeSchema, planTotal, totalSessions } = await import("@/lib/clinical");
const { decryptBuffer, encryptBuffer, decryptJson, encryptJson } = await import("@/lib/crypto");
const { validateUpload } = await import("@/lib/files");

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("treatment plan rules", () => {
  it("cannot start without informed consent", () => {
    expect(checkPlanTransition("ACCEPTED", "STARTED", { hasConsent: false, itemCount: 2 })).toMatchObject({ ok: false });
    expect(checkPlanTransition("ACCEPTED", "STARTED", { hasConsent: true, itemCount: 2 })).toEqual({ ok: true });
  });
  it("needs at least one modality before proposing", () => {
    expect(checkPlanTransition("DRAFT", "PROPOSED", { hasConsent: false, itemCount: 0 }).ok).toBe(false);
  });
  it("blocks skipping steps and reopening finished plans", () => {
    expect(checkPlanTransition("DRAFT", "STARTED", { hasConsent: true, itemCount: 1 }).ok).toBe(false);
    expect(checkPlanTransition("COMPLETED", "STARTED", { hasConsent: true, itemCount: 1 }).ok).toBe(false);
  });
  it("totals cost and sessions", () => {
    const items = [{ sessions: 6, unitPricePhp: 1500 }, { sessions: 4, unitPricePhp: 1800 }];
    expect(planTotal(items)).toBe(16200);
    expect(totalSessions(items)).toBe(10);
  });
  it("formats patient numbers", () => {
    expect(formatPatientNo(7)).toBe("CM-0007");
  });
});

describe("intake form validation", () => {
  const base = {
    firstName: "Ana", lastName: "Santos", birthDate: "1990-05-01", sex: "FEMALE", mobile: "09171234567",
    chiefComplaint: "Pabalik-balik na sakit ng ulo", consent: "on",
  };
  it("accepts a complete form", () => {
    expect(intakeSchema.safeParse(base).success).toBe(true);
  });
  it("requires consent and a chief complaint", () => {
    expect(intakeSchema.safeParse({ ...base, consent: undefined }).success).toBe(false);
    expect(intakeSchema.safeParse({ ...base, chiefComplaint: "" }).success).toBe(false);
  });
});

describe("file encryption", () => {
  it("round-trips bytes and JSON", () => {
    const bytes = randomBytes(1000);
    const enc = encryptBuffer(bytes);
    expect(enc.equals(bytes)).toBe(false);
    expect(decryptBuffer(enc).equals(bytes)).toBe(true);
    expect(decryptJson(encryptJson({ a: 1 }))).toEqual({ a: 1 });
  });
  it("rejects unsafe uploads", () => {
    expect(validateUpload({ size: 100, type: "application/pdf" })).toBeNull();
    expect(validateUpload({ size: 100, type: "text/html" })).not.toBeNull();
    expect(validateUpload({ size: 11 * 1024 * 1024, type: "image/png" })).not.toBeNull();
  });
});
