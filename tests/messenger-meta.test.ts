import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { toQuickReplies, verifySignature, withinWindow } from "@/lib/messenger/meta";
import { slotLabel } from "@/lib/messenger/handler";

describe("Meta helpers", () => {
  it("verifies webhook signatures", () => {
    const body = '{"object":"page"}';
    const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(verifySignature(body, sig, "s3cret")).toBe(true);
    expect(verifySignature(body + " ", sig, "s3cret")).toBe(false);
    expect(verifySignature(body, null, "s3cret")).toBe(false);
  });
  it("tracks the 24-hour window", () => {
    const now = new Date("2026-11-02T12:00:00Z");
    expect(withinWindow(new Date("2026-11-01T13:00:00Z"), now)).toBe(true);
    expect(withinWindow(new Date("2026-11-01T11:00:00Z"), now)).toBe(false);
    expect(withinWindow(null, now)).toBe(false);
  });
  it("caps quick replies at 13 and 20 characters", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ title: `Option number ${i} that is long`, payload: String(i) }));
    const out = toQuickReplies(many);
    expect(out).toHaveLength(13);
    expect(out.every((q) => q.title.length <= 20)).toBe(true);
  });
  it("labels slots within 20 characters", () => {
    expect(slotLabel(new Date("2026-11-04T08:30:00Z")).length).toBeLessThanOrEqual(20);
  });
});
