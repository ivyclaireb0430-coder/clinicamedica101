import { db } from "./db";
import { openSlots, overlaps, type Interval } from "./slots";
import { addDays, manilaDateString, manilaToUtc } from "./time";
import { ACTIVE_APPOINTMENT_STATUSES, LEAD_STAGE_KEYS, type AppointmentStatus } from "./constants";
import { pushAppointment } from "./google";
import { audit } from "./audit";
import { closeFollowUpsForVisit } from "./visits";

async function busyBetween(from: Date, to: Date, excludeAppointmentId?: string): Promise<Interval[]> {
  const [appts, external] = await Promise.all([
    db.appointment.findMany({
      where: {
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
        startAt: { lt: to },
        endAt: { gt: from },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { startAt: true, endAt: true },
    }),
    db.externalBusy.findMany({ where: { startAt: { lt: to }, endAt: { gt: from } }, select: { startAt: true, endAt: true } }),
  ]);
  return [...appts, ...external];
}

export async function getOpenSlots(date: string, consultationTypeId: string, now = new Date()) {
  const type = await db.consultationType.findUnique({ where: { id: consultationTypeId } });
  if (!type || !type.active) return [];
  const [rules, blocked, busy] = await Promise.all([
    db.scheduleRule.findMany(),
    db.blockedDate.findMany({ where: { date } }),
    busyBetween(manilaToUtc(date, "00:00"), manilaToUtc(addDays(date, 1), "00:00")),
  ]);
  return openSlots({
    date,
    durationMin: type.durationMin,
    rules,
    blockedDates: blocked.map((b) => b.date),
    busy,
    now,
  });
}

export class SlotTakenError extends Error {
  constructor() {
    super("That time is no longer available. Please pick another slot.");
  }
}

export async function createAppointment(input: {
  leadId: string;
  consultationTypeId: string;
  startAt: Date;
  channel?: string;
  notes?: string;
  userId?: string | null;
  rescheduledFromId?: string;
}) {
  const type = await db.consultationType.findUniqueOrThrow({ where: { id: input.consultationTypeId } });
  const endAt = new Date(input.startAt.getTime() + type.durationMin * 60_000);
  const busy = await busyBetween(input.startAt, endAt, input.rescheduledFromId);
  if (busy.some((b) => overlaps({ startAt: input.startAt, endAt }, b))) throw new SlotTakenError();

  const appt = await db.appointment.create({
    data: {
      leadId: input.leadId,
      consultationTypeId: type.id,
      startAt: input.startAt,
      endAt,
      channel: input.channel ?? "STAFF",
      notes: input.notes,
      rescheduledFromId: input.rescheduledFromId,
    },
  });
  await advanceLeadStage(input.leadId, "BOOKED", input.userId);
  await audit({ userId: input.userId, action: "CREATE", entity: "Appointment", entityId: appt.id });
  await pushAppointment(appt.id);
  return appt;
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus, userId?: string | null) {
  const appt = await db.appointment.update({ where: { id }, data: { status } });
  if (status === "ATTENDED") {
    await advanceLeadStage(appt.leadId, "ATTENDED", userId);
    const patient = await db.patient.findUnique({ where: { leadId: appt.leadId }, select: { id: true } });
    if (patient) await closeFollowUpsForVisit(patient.id, manilaDateString(appt.startAt));
  }
  await audit({ userId, action: "UPDATE", entity: "Appointment", entityId: id, detail: `status=${status}` });
  await pushAppointment(id);
  return appt;
}

export async function rescheduleAppointment(id: string, newStart: Date, userId?: string | null) {
  const old = await db.appointment.findUniqueOrThrow({ where: { id } });
  const fresh = await createAppointment({
    leadId: old.leadId,
    consultationTypeId: old.consultationTypeId,
    startAt: newStart,
    channel: old.channel,
    notes: old.notes ?? undefined,
    userId,
    rescheduledFromId: old.id,
  });
  await setAppointmentStatus(old.id, "RESCHEDULED", userId);
  return fresh;
}

/** Move a lead forward in the pipeline (never backwards, never out of LOST automatically). */
export async function advanceLeadStage(leadId: string, to: (typeof LEAD_STAGE_KEYS)[number], userId?: string | null) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const order = LEAD_STAGE_KEYS;
  if (lead.stage === "LOST" && to !== "BOOKED") return;
  if (lead.stage !== "LOST" && order.indexOf(to) <= order.indexOf(lead.stage as (typeof order)[number])) return;
  await db.$transaction([
    db.lead.update({ where: { id: leadId }, data: { stage: to, lostReason: null, lastContactAt: new Date() } }),
    db.leadStageChange.create({ data: { leadId, fromStage: lead.stage, toStage: to, userId: userId ?? null } }),
  ]);
}
