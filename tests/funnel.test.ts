import { describe, expect, it } from "vitest";
import { campaignCodeFrom, createRateLimiter, inquiryNote, landingInquirySchema, lines, normalizePhMobile, parseFaq } from "@/lib/funnel";
import { attachVisits, type FunnelRow } from "@/lib/dashboard";

describe("landing page funnel", () => {
  it("normalizes Philippine mobile numbers", () => {
    expect(normalizePhMobile("0917 123 4567")).toBe("09171234567");
    expect(normalizePhMobile("+63 917-123-4567")).toBe("09171234567");
    expect(normalizePhMobile("639171234567")).toBe("09171234567");
    expect(normalizePhMobile("9171234567")).toBe("09171234567");
    expect(normalizePhMobile("(02) 8123 4567")).toBeNull();
    expect(normalizePhMobile("0917123456")).toBeNull();
    expect(normalizePhMobile("abc")).toBeNull();
  });

  it("reads the campaign code from ?c= or ?utm_campaign=, and rejects junk", () => {
    expect(campaignCodeFrom({ c: "Reel-Headache" })).toBe("reel-headache");
    expect(campaignCodeFrom({ utm_campaign: "nov_promo" })).toBe("nov_promo");
    expect(campaignCodeFrom({ c: ["a1", "b2"] })).toBe("a1");
    expect(campaignCodeFrom({ c: "<script>" })).toBeNull();
    expect(campaignCodeFrom({})).toBeNull();
  });

  it("parses benefits and FAQ text", () => {
    expect(lines("a\n\n b \r\nc")).toEqual(["a", "b", "c"]);
    expect(parseFaq("Q1? | A1\nno pipe here\n | empty q\nQ2|A | with pipe")).toEqual([
      { q: "Q1?", a: "A1" },
      { q: "Q2", a: "A | with pipe" },
    ]);
  });

  it("validates the inquiry form", () => {
    const ok = landingInquirySchema.safeParse({ firstName: "Ana", mobile: "+639171234567", consent: "on", email: "" });
    expect(ok.success).toBe(true);
    expect(ok.data).toMatchObject({ firstName: "Ana", mobile: "09171234567", preferredTime: "ANY", contactMethod: "CALL", email: undefined });
    expect(landingInquirySchema.safeParse({ firstName: "Ana", mobile: "12345", consent: "on" }).success).toBe(false);
    expect(landingInquirySchema.safeParse({ firstName: "Ana", mobile: "09171234567" }).success).toBe(false); // no consent
    expect(landingInquirySchema.safeParse({ firstName: "", mobile: "09171234567", consent: "on" }).success).toBe(false);
    expect(landingInquirySchema.safeParse({ firstName: "Ana", mobile: "09171234567", consent: "on", preferredTime: "MIDNIGHT" }).success).toBe(false);
  });

  it("writes a front desk note without the health concern", () => {
    const note = inquiryNote({ preferredTime: "SATURDAY", contactMethod: "VIBER" }, "Nov promo");
    expect(note).toBe("Web form (Nov promo): gusto ng schedule sabado, contact via Viber.");
  });

  it("rate limits per key within a window", () => {
    const allow = createRateLimiter(2, 1000);
    expect(allow("ip", 0)).toBe(true);
    expect(allow("ip", 10)).toBe(true);
    expect(allow("ip", 20)).toBe(false);
    expect(allow("other", 20)).toBe(true);
    expect(allow("ip", 1001)).toBe(true);
  });

  it("adds landing visits to funnel rows, including campaigns with visits but no inquiries", () => {
    const row = (key: string, inquiries: number): FunnelRow => ({ key, label: key, inquiries, booked: 0, attended: 0, treatment: 0, revenue: 0 });
    const out = attachVisits([row("c1", 3), row("none", 5)], new Map([["c1", 40], ["c2", 12]]), new Map([["c2", "Reel 2"]]));
    expect(out.map((r) => [r.key, r.label, r.visits, r.inquiries])).toEqual([
      ["c1", "c1", 40, 3],
      ["none", "none", 0, 5],
      ["c2", "Reel 2", 12, 0],
    ]);
  });
});
