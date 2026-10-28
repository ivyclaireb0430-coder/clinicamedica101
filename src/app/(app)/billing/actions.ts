"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { CHARGE_CATEGORY_KEYS, PAYMENT_METHODS, PAYMENT_METHOD_KEYS, nextReceiptNo, packageActive } from "@/lib/billing";
import { manilaDateString, todayManila } from "@/lib/time";

const text = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const billingTab = (patientId: string, extra = "") => `/patients/${patientId}?tab=billing${extra}`;
const fail = (patientId: string, msg: string) => redirect(billingTab(patientId, `&error=${encodeURIComponent(msg)}`));

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const pesos = z.coerce.number().int("Whole pesos only").positive("Amount must be more than ₱0").max(10_000_000);

export async function addCharge(patientId: string, fd: FormData) {
  const user = await requirePermission("billing:write");
  const parsed = z
    .object({ date, category: z.enum(CHARGE_CATEGORY_KEYS), description: z.string().trim().min(1).max(120), amountPhp: pesos })
    .safeParse({ date: text(fd, "date") ?? todayManila(), category: text(fd, "category"), description: text(fd, "description"), amountPhp: text(fd, "amountPhp") });
  if (!parsed.success) fail(patientId, parsed.error.issues[0].message);
  const c = await db.charge.create({ data: { patientId, ...parsed.data!, createdById: user.id } });
  await audit({ userId: user.id, action: "CREATE", entity: "Charge", entityId: c.id, detail: `₱${c.amountPhp}` });
  redirect(billingTab(patientId, "&saved=charge"));
}

/** One-click consultation charge from an appointment, at the consultation type's fee. */
export async function chargeAppointment(appointmentId: string) {
  const user = await requirePermission("billing:write");
  const appt = await db.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: { consultationType: true, charges: { where: { voidedAt: null } }, lead: { select: { patient: { select: { id: true } } } } },
  });
  const patientId = appt.lead.patient?.id;
  if (!patientId) redirect(`/appointments/${appointmentId}?error=nopatient`);
  if (appt.charges.length === 0) {
    const c = await db.charge.create({
      data: {
        patientId, date: manilaDateString(appt.startAt), category: "CONSULTATION", description: appt.consultationType.name,
        amountPhp: appt.consultationType.feePhp, appointmentId, createdById: user.id,
      },
    });
    await audit({ userId: user.id, action: "CREATE", entity: "Charge", entityId: c.id, detail: `₱${c.amountPhp}` });
  }
  redirect(billingTab(patientId, "&saved=charge"));
}

export async function recordPayment(patientId: string, fd: FormData) {
  const user = await requirePermission("billing:write");
  const parsed = z
    .object({
      date, amountPhp: pesos, method: z.enum(PAYMENT_METHOD_KEYS),
      reference: z.string().max(60).nullable(), orNumber: z.string().max(40).nullable(), notes: z.string().max(200).nullable(),
    })
    .safeParse({
      date: text(fd, "date") ?? todayManila(), amountPhp: text(fd, "amountPhp"), method: text(fd, "method"),
      reference: text(fd, "reference"), orNumber: text(fd, "orNumber"), notes: text(fd, "notes"),
    });
  if (!parsed.success) fail(patientId, parsed.error.issues[0].message);
  const data = parsed.data!;
  const method = PAYMENT_METHODS.find((m) => m.key === data.method)!;
  if (method.needsRef && !data.reference) fail(patientId, `Enter the ${method.label} reference number`);

  // Retry once if two payments race for the same receipt number.
  let payment;
  for (let attempt = 0; ; attempt++) {
    try {
      payment = await db.payment.create({ data: { patientId, ...data, receiptNo: await nextReceiptNo(data.date), receivedById: user.id } });
      break;
    } catch (err) {
      if (attempt >= 2 || !(err instanceof Error && err.message.includes("Unique constraint"))) throw err;
    }
  }
  await audit({ userId: user.id, action: "CREATE", entity: "Payment", entityId: payment.id, detail: `₱${payment.amountPhp} ${payment.method}` });
  redirect(billingTab(patientId, `&paid=${payment.id}`));
}

export async function voidPayment(paymentId: string, fd: FormData) {
  const user = await requirePermission("billing:void");
  const reason = text(fd, "reason");
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (!reason) fail(p.patientId, "Give a reason for voiding");
  await db.payment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidReason: reason } });
  await audit({ userId: user.id, action: "VOID", entity: "Payment", entityId: paymentId });
  redirect(billingTab(p.patientId, "&saved=void"));
}

export async function voidCharge(chargeId: string, fd: FormData) {
  const user = await requirePermission("billing:void");
  const reason = text(fd, "reason");
  const c = await db.charge.findUniqueOrThrow({ where: { id: chargeId } });
  if (!reason) fail(c.patientId, "Give a reason for voiding");
  await db.charge.update({ where: { id: chargeId }, data: { voidedAt: new Date(), voidReason: reason } });
  if (c.packageId) await db.patientPackage.update({ where: { id: c.packageId }, data: { cancelledAt: new Date() } });
  await audit({ userId: user.id, action: "VOID", entity: "Charge", entityId: chargeId });
  redirect(billingTab(c.patientId, "&saved=void"));
}

export async function sellPackage(patientId: string, fd: FormData) {
  const user = await requirePermission("billing:write");
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80), sessionsTotal: z.coerce.number().int().min(1).max(100),
      pricePhp: pesos, purchasedOn: date, expiresOn: date.nullable(),
    })
    .safeParse({
      name: text(fd, "name"), sessionsTotal: text(fd, "sessionsTotal"), pricePhp: text(fd, "pricePhp"),
      purchasedOn: text(fd, "purchasedOn") ?? todayManila(), expiresOn: text(fd, "expiresOn"),
    });
  if (!parsed.success) fail(patientId, parsed.error.issues[0].message);
  const d = parsed.data!;
  const pkg = await db.patientPackage.create({
    data: {
      patientId, ...d, createdById: user.id,
      charge: { create: { patientId, date: d.purchasedOn, category: "PACKAGE", description: `${d.name} (${d.sessionsTotal} sessions)`, amountPhp: d.pricePhp, createdById: user.id } },
    },
  });
  await audit({ userId: user.id, action: "CREATE", entity: "PatientPackage", entityId: pkg.id });
  redirect(billingTab(patientId, "&saved=package"));
}

/** Use one prepaid session outside the session log (e.g. a visit logged elsewhere). */
export async function usePackage(packageId: string, fd: FormData) {
  const user = await requirePermission("billing:write");
  const pkg = await db.patientPackage.findUniqueOrThrow({ where: { id: packageId }, include: { uses: true } });
  if (!packageActive(pkg)) fail(pkg.patientId, "This package has no sessions left");
  await db.packageUse.create({ data: { packageId, date: text(fd, "date") ?? todayManila(), note: text(fd, "note") } });
  await audit({ userId: user.id, action: "UPDATE", entity: "PatientPackage", entityId: packageId, detail: "session used" });
  redirect(billingTab(pkg.patientId, "&saved=used"));
}
