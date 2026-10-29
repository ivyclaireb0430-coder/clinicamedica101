import { describe, expect, it } from "vitest";
import { buildFunnel, funnelTotal, periodFor, previousPeriod, nextPeriod, rate } from "@/lib/dashboard";
import { weeklySummaryText } from "@/lib/weekly";
import { csvCell, toCsv } from "@/lib/csv";

describe("dashboard periods", () => {
  it("weeks run Monday to Sunday", () => {
    const p = periodFor("week", "2026-10-28"); // Wednesday
    expect([p.start, p.end]).toEqual(["2026-10-26", "2026-11-01"]);
    expect(previousPeriod(p).start).toBe("2026-10-19");
    expect(nextPeriod(p).start).toBe("2026-11-02");
  });
  it("months are calendar months", () => {
    const p = periodFor("month", "2026-03-15");
    expect([p.start, p.end]).toEqual(["2026-03-01", "2026-03-31"]);
    expect(previousPeriod(p)).toMatchObject({ start: "2026-02-01", end: "2026-02-28" });
  });
  it("rates guard against dividing by zero", () => {
    expect(rate(1, 4)).toBe(25);
    expect(rate(0, 0)).toBeNull();
  });
});

describe("funnel", () => {
  const lead = (source: string, appts: string[], started = false, paid: number[] = [], voided = false) => ({
    id: Math.random().toString(),
    source,
    campaign: null,
    appointments: appts.map((status) => ({ status })),
    patient: appts.includes("ATTENDED")
      ? { plans: started ? [{ status: "STARTED", startedAt: new Date() }] : [], payments: paid.map((amountPhp) => ({ amountPhp, voidedAt: voided ? new Date() : null })) }
      : null,
  });
  it("counts each stage per source and only non-voided revenue", () => {
    const rows = buildFunnel(
      [
        lead("MESSENGER", []),
        lead("MESSENGER", ["NO_SHOW"]),
        lead("MESSENGER", ["NO_SHOW", "ATTENDED"], true, [2500, 1800]),
        lead("RADIO", ["ATTENDED"], false, [2500], true),
      ],
      (l) => ({ key: l.source, label: l.source }),
    );
    const m = rows.find((r) => r.key === "MESSENGER")!;
    expect(m).toMatchObject({ inquiries: 3, booked: 2, attended: 1, treatment: 1, revenue: 4300 });
    expect(rows.find((r) => r.key === "RADIO")).toMatchObject({ inquiries: 1, attended: 1, treatment: 0, revenue: 0 });
    expect(rows[0].key).toBe("MESSENGER");
    expect(funnelTotal(rows)).toMatchObject({ inquiries: 4, booked: 3, attended: 2, treatment: 1, revenue: 4300 });
  });
});

describe("weekly email", () => {
  const m = { inquiries: 12, booked: 6, attended: 4, noShows: 1, noShowRate: 20, continuedTreatment: 2, returned: 3, collected: 15000, outstanding: 4000 };
  const p = { ...m, inquiries: 10, collected: 0 };
  it("summarises numbers with changes and never includes names", () => {
    const text = weeklySummaryText({
      period: periodFor("week", "2026-10-19"), prev: periodFor("week", "2026-10-12"), m, p,
      bySource: [{ key: "MESSENGER", label: "Messenger", inquiries: 8, booked: 4, attended: 3, treatment: 2, revenue: 9000 }],
      followUpsDue: 2, needsDoctor: 1, appUrl: "https://clinic.example",
    });
    expect(text).toContain("New inquiries: 12 (+20%, was 10)");
    expect(text).toContain("Collected: ₱15,000 (new, was ₱0)");
    expect(text).toContain("- Messenger: 8 > 4 > 3 > 2, ₱9,000");
    expect(text).toContain("Inquiry to booked: 50%");
    expect(text).toContain("https://clinic.example/?period=week&date=2026-10-19");
  });
});

describe("csv", () => {
  it("quotes and defuses formulas", () => {
    expect(csvCell('Hello, "Doc"')).toBe('"Hello, ""Doc"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-500)).toBe("-500");
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, "x\ny"]])).toBe('a,b\r\n1,"x\ny"\r\n');
  });
});
