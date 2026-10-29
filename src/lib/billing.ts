import { db } from "./db";
import { addDays, todayManila } from "./time";

export const PAYMENT_METHODS = [
  { key: "CASH", label: "Cash", needsRef: false },
  { key: "GCASH", label: "GCash", needsRef: true },
  { key: "MAYA", label: "Maya", needsRef: true },
  { key: "CARD", label: "Credit card", needsRef: true },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["key"];
export const PAYMENT_METHOD_KEYS = PAYMENT_METHODS.map((m) => m.key) as [PaymentMethod, ...PaymentMethod[]];
export const methodLabel = (k: string) => PAYMENT_METHODS.find((m) => m.key === k)?.label ?? k;

export const CHARGE_CATEGORIES = [
  { key: "CONSULTATION", label: "Consultation" },
  { key: "SESSION", label: "Treatment session" },
  { key: "PACKAGE", label: "Package" },
  { key: "OTHER", label: "Other" },
] as const;
export const CHARGE_CATEGORY_KEYS = CHARGE_CATEGORIES.map((c) => c.key) as [string, ...string[]];
export const categoryLabel = (k: string) => CHARGE_CATEGORIES.find((c) => c.key === k)?.label ?? k;

export const AGING_BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

type ChargeIn = { id: string; date: string; amountPhp: number; createdAt?: Date };
type PaymentIn = { id: string; date: string; amountPhp: number; createdAt?: Date };

export type Allocation = { paymentId: string; chargeId: string; amountPhp: number };

const byDate = <T extends { date: string; createdAt?: Date }>(a: T, b: T) =>
  a.date.localeCompare(b.date) || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);

/**
 * Apply payments to charges, oldest charge first. Pass only non-voided rows.
 * Returns what each charge still owes and any unapplied credit (advance payment).
 */
export function allocateFifo(charges: ChargeIn[], payments: PaymentIn[]) {
  const open = [...charges].sort(byDate).map((c) => ({ id: c.id, date: c.date, due: c.amountPhp }));
  const allocations: Allocation[] = [];
  let credit = 0;
  for (const p of [...payments].sort(byDate)) {
    let left = p.amountPhp;
    for (const c of open) {
      if (left <= 0) break;
      if (c.due <= 0) continue;
      const take = Math.min(c.due, left);
      c.due -= take;
      left -= take;
      allocations.push({ paymentId: p.id, chargeId: c.id, amountPhp: take });
    }
    credit += left;
  }
  const outstanding = Object.fromEntries(open.map((c) => [c.id, c.due]));
  const balance = open.reduce((s, c) => s + c.due, 0);
  return { allocations, outstanding, balance, credit };
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

export function agingBucket(chargeDate: string, asOf: string): AgingBucket {
  const d = daysBetween(chargeDate, asOf);
  if (d <= 30) return "0-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "90+";
}

/** Outstanding amounts by aging bucket for one patient (pure). */
export function agingFor(charges: ChargeIn[], payments: PaymentIn[], asOf: string) {
  const { outstanding, credit } = allocateFifo(charges, payments);
  const buckets: Record<AgingBucket, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  let oldest: string | null = null;
  for (const c of charges) {
    const due = outstanding[c.id] ?? 0;
    if (due <= 0) continue;
    buckets[agingBucket(c.date, asOf)] += due;
    if (!oldest || c.date < oldest) oldest = c.date;
  }
  const total = AGING_BUCKETS.reduce((s, b) => s + buckets[b], 0);
  return { buckets, total, credit, oldest };
}

/** Sessions left on a package. */
export function packageRemaining(pkg: { sessionsTotal: number; uses: unknown[] }) {
  return Math.max(0, pkg.sessionsTotal - pkg.uses.length);
}

export function packageActive(pkg: { sessionsTotal: number; uses: unknown[]; cancelledAt: Date | null; expiresOn: string | null }, today = todayManila()) {
  return !pkg.cancelledAt && packageRemaining(pkg) > 0 && (!pkg.expiresOn || pkg.expiresOn >= today);
}

// ── Database helpers ──

/** Everything needed for a patient's billing tab. */
export async function patientLedger(patientId: string, asOf = todayManila()) {
  const [charges, payments, packages] = await Promise.all([
    db.charge.findMany({ where: { patientId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    db.payment.findMany({ where: { patientId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    db.patientPackage.findMany({ where: { patientId }, include: { uses: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const liveCharges = charges.filter((c) => !c.voidedAt);
  const livePayments = payments.filter((p) => !p.voidedAt);
  const alloc = allocateFifo(liveCharges, livePayments);
  const aging = agingFor(liveCharges, livePayments, asOf);
  return { charges, payments, packages, ...alloc, aging };
}

/** Outstanding receivables for every patient with a balance, with aging. */
export async function receivables(asOf = todayManila()) {
  const [charges, payments] = await Promise.all([
    db.charge.findMany({ where: { voidedAt: null, date: { lte: asOf } } }),
    db.payment.findMany({ where: { voidedAt: null, date: { lte: asOf } } }),
  ]);
  const ids = new Set(charges.map((c) => c.patientId));
  const rows = [];
  for (const patientId of ids) {
    const a = agingFor(charges.filter((c) => c.patientId === patientId), payments.filter((p) => p.patientId === patientId), asOf);
    if (a.total > 0) rows.push({ patientId, ...a });
  }
  const patients = await db.patient.findMany({
    where: { id: { in: rows.map((r) => r.patientId) } },
    select: { id: true, patientNo: true, firstName: true, lastName: true, mobile: true },
  });
  const byId = new Map(patients.map((p) => [p.id, p]));
  const totals: Record<AgingBucket, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const r of rows) for (const b of AGING_BUCKETS) totals[b] += r.buckets[b];
  return {
    rows: rows.map((r) => ({ ...r, patient: byId.get(r.patientId)! })).sort((a, b) => b.total - a.total),
    totals,
    total: AGING_BUCKETS.reduce((s, b) => s + totals[b], 0),
  };
}

/** Next acknowledgement receipt number, e.g. AR-2026-00012 (sequence restarts each year). */
export async function nextReceiptNo(date = todayManila()): Promise<string> {
  const year = date.slice(0, 4);
  const last = await db.payment.findFirst({ where: { receiptNo: { startsWith: `AR-${year}-` } }, orderBy: { receiptNo: "desc" } });
  const n = last ? Number(last.receiptNo.split("-")[2]) + 1 : 1;
  return `AR-${year}-${String(n).padStart(5, "0")}`;
}

/** First and last day of a "YYYY-MM" month. */
export function monthRange(month: string) {
  const start = `${month}-01`;
  const next = new Date(`${start}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start, end: addDays(next.toISOString().slice(0, 10), -1) };
}

export function prevMonth(month: string): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

export function sumBy<T>(rows: T[], key: (r: T) => string, amount: (r: T) => number) {
  const out: Record<string, number> = {};
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + amount(r);
  return out;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function under1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
  const r = n % 100;
  if (r >= 20) parts.push(TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : ""));
  else if (r > 0) parts.push(ONES[r]);
  return parts.join(" ");
}

/** Whole-peso amount in words for receipts, e.g. 2500 → "Two Thousand Five Hundred Pesos Only". */
export function pesosInWords(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("Whole pesos only");
  if (amount === 0) return "Zero Pesos Only";
  const scales = ["", " Thousand", " Million"];
  const parts: string[] = [];
  let n = amount;
  for (let i = 0; n > 0 && i < scales.length; i++) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(under1000(chunk) + scales[i]);
    n = Math.floor(n / 1000);
  }
  return `${parts.join(" ")} ${amount === 1 ? "Peso" : "Pesos"} Only`;
}
