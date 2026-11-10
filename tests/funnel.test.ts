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
    expect(landingInquirySchema.safeParse({ firstName: "Ana", mobile: "09171234567", consent: "on", preferredTime: "WEEKDAY_AM" }).success).toBe(false); // no morning consults
  });

  it("builds a tap-to-call link for the clinic number", async () => {
    const { telHref } = await import("@/lib/funnel");
    expect(telHref("0922 875 2899")).toBe("tel:+639228752899");
    expect(telHref("")).toBeNull();
  });

  it("writes a front desk note without the health concern", () => {
    const note = inquiryNote({ preferredTime: "WEEKEND", contactMethod: "VIBER" }, "Nov promo");
    expect(note).toBe("Web form (Nov promo): gusto ng schedule sabado o linggo, contact via Viber.");
    expect(inquiryNote({ preferredTime: "ANY", contactMethod: "CALL", promoInterest: "on" }, null, "Vector Scan")).toBe(
      "Web form: gusto ng schedule kahit kailan, contact via Tawag. Interesado sa Vector Scan promo.",
    );
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

describe("dedicated funnels", async () => {
  const { funnelCopy, isLandingPage, pageLang, pagePath, UI } = await import("@/lib/landing-content");
  const { inquiryErrorMessage } = await import("@/lib/funnel");
  const vars = { doctor: "Dr. Irene Lim", promoName: "Vector Scan", promoPrice: "₱3,000", promoOld: "₱16,000", consultFee: "₱1,000", seniorFee: "₱800" };

  it("maps page ids to paths and languages, rejecting unknown ids", () => {
    expect(pagePath("start")).toBe("/start");
    expect(pagePath("vector-scan/en")).toBe("/start/vector-scan/en");
    expect(pageLang("consultation/en")).toBe("en");
    expect(pageLang("consultation")).toBe("tl");
    expect(isLandingPage("vector-scan")).toBe(true);
    expect(isLandingPage("../admin")).toBe(false);
  });

  it("puts the configured prices into the copy in both languages", () => {
    const tl = funnelCopy("vector-scan", "tl", vars);
    const en = funnelCopy("vector-scan", "en", vars);
    expect(tl.headline).toContain("₱3,000");
    expect(en.offer).toContain("regular ₱16,000");
    expect(en.faq.find((f) => f.q.startsWith("How much"))?.a).toContain("₱800 for Senior Citizens");
    expect(funnelCopy("consultation", "en", vars).sub).toContain("₱1,000");
    expect(funnelCopy("consultation", "tl", { ...vars, seniorFee: "" }).sub).not.toContain("Senior");
  });

  it("never promises a cure in the funnel copy", () => {
    for (const f of ["vector-scan", "consultation"] as const) {
      for (const l of ["tl", "en"] as const) {
        const text = JSON.stringify(funnelCopy(f, l, vars)).toLowerCase();
        expect(text).not.toMatch(/\bcure|gagaling|guarantee|garantisado/);
      }
    }
  });

  it("has the same interface text keys in Taglish and English", () => {
    expect(Object.keys(UI.en).sort()).toEqual(Object.keys(UI.tl).sort());
    expect(inquiryErrorMessage("mobile", "en")).toMatch(/mobile number/);
    expect(inquiryErrorMessage("whatever", "tl")).toBe("Pakisuri ang form.");
  });
});

describe("self-booking", async () => {
  const { spreadSlots, landingInquirySchema: schema } = await import("@/lib/funnel");
  it("spreads slots evenly, keeping the first and last", () => {
    expect(spreadSlots([1, 2, 3], 8)).toEqual([1, 2, 3]);
    expect(spreadSlots([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3)).toEqual([0, 5, 10]);
    expect(spreadSlots([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4)).toEqual([0, 3, 6, 9]);
  });
  it("parses the chosen slot, and treats empty as 'call me'", () => {
    const base = { firstName: "Ana", mobile: "09171234567", consent: "on" };
    expect(schema.parse({ ...base, slotStart: "2026-11-12T02:00:00.000Z" }).slotStart?.toISOString()).toBe("2026-11-12T02:00:00.000Z");
    expect(schema.parse({ ...base, slotStart: "" }).slotStart).toBeUndefined();
    expect(schema.safeParse({ ...base, slotStart: "tomorrow-ish" }).success).toBe(false);
  });
});

describe("booking calendar", async () => {
  const { calendarWeeks } = await import("@/app/start/SlotPicker");
  it("lays the open days out in Sunday-first weeks, with closed days kept in place", () => {
    // Tue Nov 10 to Mon Nov 16, 2026, with Thu Nov 12 closed
    const weeks = calendarWeeks(["2026-11-10", "2026-11-11", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"]);
    expect(weeks).toEqual([
      [null, null, "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"],
      ["2026-11-15", "2026-11-16", null, null, null, null, null],
    ]);
    expect(calendarWeeks([])).toEqual([]);
  });
});
