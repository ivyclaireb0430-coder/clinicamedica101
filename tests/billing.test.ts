import { describe, expect, it } from "vitest";
import { agingBucket, agingFor, allocateFifo, monthRange, packageActive, packageRemaining, pesosInWords, prevMonth } from "@/lib/billing";

describe("payment allocation (oldest charge first)", () => {
  const charges = [
    { id: "c2", date: "2026-10-10", amountPhp: 1800 },
    { id: "c1", date: "2026-10-01", amountPhp: 2500 },
  ];
  it("pays the oldest charge first and supports partial payments", () => {
    const r = allocateFifo(charges, [{ id: "p1", date: "2026-10-12", amountPhp: 3000 }]);
    expect(r.outstanding).toEqual({ c1: 0, c2: 1300 });
    expect(r.balance).toBe(1300);
    expect(r.credit).toBe(0);
    expect(r.allocations).toEqual([
      { paymentId: "p1", chargeId: "c1", amountPhp: 2500 },
      { paymentId: "p1", chargeId: "c2", amountPhp: 500 },
    ]);
  });
  it("keeps overpayment as credit", () => {
    const r = allocateFifo(charges, [{ id: "p1", date: "2026-10-01", amountPhp: 5000 }]);
    expect(r.balance).toBe(0);
    expect(r.credit).toBe(700);
  });
  it("advance payment covers a later charge", () => {
    const r = allocateFifo([{ id: "c", date: "2026-10-20", amountPhp: 1000 }], [{ id: "p", date: "2026-10-01", amountPhp: 1000 }]);
    expect(r.balance).toBe(0);
  });
});

describe("receivables aging", () => {
  it("buckets by days since the charge", () => {
    expect(agingBucket("2026-10-28", "2026-10-28")).toBe("0-30");
    expect(agingBucket("2026-09-28", "2026-10-28")).toBe("0-30");
    expect(agingBucket("2026-09-27", "2026-10-28")).toBe("31-60");
    expect(agingBucket("2026-08-01", "2026-10-28")).toBe("61-90");
    expect(agingBucket("2026-07-01", "2026-10-28")).toBe("90+");
  });
  it("ages only what is still unpaid", () => {
    const a = agingFor(
      [{ id: "old", date: "2026-07-01", amountPhp: 1000 }, { id: "new", date: "2026-10-20", amountPhp: 2000 }],
      [{ id: "p", date: "2026-10-21", amountPhp: 1500 }],
      "2026-10-28",
    );
    expect(a.buckets).toEqual({ "0-30": 1500, "31-60": 0, "61-90": 0, "90+": 0 });
    expect(a.total).toBe(1500);
    expect(a.oldest).toBe("2026-10-20");
  });
});

describe("packages", () => {
  const pkg = { sessionsTotal: 2, uses: [{}], cancelledAt: null, expiresOn: null };
  it("counts remaining sessions and expiry", () => {
    expect(packageRemaining(pkg)).toBe(1);
    expect(packageActive(pkg, "2026-10-28")).toBe(true);
    expect(packageActive({ ...pkg, uses: [{}, {}] }, "2026-10-28")).toBe(false);
    expect(packageActive({ ...pkg, expiresOn: "2026-10-27" }, "2026-10-28")).toBe(false);
    expect(packageActive({ ...pkg, cancelledAt: new Date() }, "2026-10-28")).toBe(false);
  });
});

describe("receipt helpers", () => {
  it("writes pesos in words", () => {
    expect(pesosInWords(2500)).toBe("Two Thousand Five Hundred Pesos Only");
    expect(pesosInWords(1)).toBe("One Peso Only");
    expect(pesosInWords(18_945)).toBe("Eighteen Thousand Nine Hundred Forty-Five Pesos Only");
    expect(pesosInWords(1_000_000)).toBe("One Million Pesos Only");
  });
  it("handles month ranges", () => {
    expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(prevMonth("2026-01")).toBe("2025-12");
  });
});
