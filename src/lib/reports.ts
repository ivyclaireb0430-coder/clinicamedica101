import { db } from "./db";
import { manilaToUtc, addDays } from "./time";
import { monthRange, receivables, sumBy } from "./billing";

/** Payments received on one day, with totals per method. */
export async function dailyCollections(date: string) {
  const payments = await db.payment.findMany({
    where: { date },
    orderBy: { createdAt: "asc" },
    include: { patient: { select: { id: true, patientNo: true, firstName: true, lastName: true } } },
  });
  const live = payments.filter((p) => !p.voidedAt);
  return {
    payments,
    byMethod: sumBy(live, (p) => p.method, (p) => p.amountPhp),
    total: live.reduce((s, p) => s + p.amountPhp, 0),
    voided: payments.length - live.length,
  };
}

/** Month performance numbers for the monthly report. */
export async function monthSummary(month: string) {
  const { start, end } = monthRange(month);
  const from = manilaToUtc(start, "00:00");
  const to = manilaToUtc(addDays(end, 1), "00:00");
  const [charges, payments, newPatients, attended, noShows, sessions, packages, ar] = await Promise.all([
    db.charge.findMany({ where: { voidedAt: null, date: { gte: start, lte: end } } }),
    db.payment.findMany({ where: { voidedAt: null, date: { gte: start, lte: end } } }),
    db.patient.count({ where: { createdAt: { gte: from, lt: to } } }),
    db.appointment.count({ where: { status: "ATTENDED", startAt: { gte: from, lt: to } } }),
    db.appointment.count({ where: { status: "NO_SHOW", startAt: { gte: from, lt: to } } }),
    db.treatmentSession.count({ where: { date: { gte: start, lte: end } } }),
    db.patientPackage.findMany({ where: { purchasedOn: { gte: start, lte: end }, cancelledAt: null } }),
    receivables(end),
  ]);
  const collected = payments.reduce((s, p) => s + p.amountPhp, 0);
  const payingPatients = new Set(payments.map((p) => p.patientId)).size;
  return {
    month, start, end,
    charged: charges.reduce((s, c) => s + c.amountPhp, 0),
    collected,
    byMethod: sumBy(payments, (p) => p.method, (p) => p.amountPhp),
    byCategory: sumBy(charges, (c) => c.category, (c) => c.amountPhp),
    newPatients, attended, noShows, sessions,
    packagesSold: packages.length,
    packageRevenue: packages.reduce((s, p) => s + p.pricePhp, 0),
    payingPatients,
    avgPerPatient: payingPatients ? Math.round(collected / payingPatients) : 0,
    receivablesAtEnd: ar.total,
  };
}

/** Percentage change, or null when there's nothing to compare against. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}
