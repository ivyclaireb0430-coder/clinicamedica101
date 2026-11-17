import { describe, expect, it } from "vitest";
import { bookingHref, mapsHref, parseServices, sitePath } from "@/lib/site-content";
import { SETTING_DEFAULTS } from "@/lib/settings";

describe("clinic website", () => {
  it("parses services from Name | Description | link lines", () => {
    expect(parseServices("Consult | Long talk | consultation\n\nScan|Quick scan|VECTOR-SCAN\nPlan\n | no name\nOther | x | weird")).toEqual([
      { name: "Consult", description: "Long talk", link: "consultation" },
      { name: "Scan", description: "Quick scan", link: "vector-scan" },
      { name: "Plan", description: "", link: "consultation" },
      { name: "Other", description: "x", link: "consultation" },
    ]);
  });

  it("links booking buttons to the funnel page in the same language, tagged as website", () => {
    expect(bookingHref("consultation", "tl")).toBe("/start/consultation?c=website");
    expect(bookingHref("vector-scan", "en")).toBe("/start/vector-scan/en?c=website");
    expect(bookingHref("start", "en")).toBe("/start?c=website");
    expect(sitePath("en")).toBe("/clinic");
    expect(sitePath("tl")).toBe("/clinic/tl");
    expect(mapsHref("Centuria Medical Makati")).toBe("https://www.google.com/maps/search/?api=1&query=Centuria%20Medical%20Makati");
  });

  it("ships the same number of services in Taglish and English, with no cure claims", () => {
    const tl = parseServices(SETTING_DEFAULTS.siteServices);
    const en = parseServices(SETTING_DEFAULTS.siteServicesEn);
    expect(tl.length).toBe(en.length);
    expect(tl.map((s) => s.link)).toEqual(en.map((s) => s.link));
    const all = [SETTING_DEFAULTS.siteServices, SETTING_DEFAULTS.siteServicesEn, SETTING_DEFAULTS.siteHeadline, SETTING_DEFAULTS.siteIntro].join(" ").toLowerCase();
    for (const word of ["cure", "gagaling", "guarantee", "lunas"]) expect(all).not.toContain(word);
  });
});
