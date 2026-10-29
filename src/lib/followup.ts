import { randomBytes } from "node:crypto";
import { db } from "./db";
import { audit } from "./audit";
import { getNumberSetting, getSetting } from "./settings";
import { addDays, formatDate, manilaDateString, manilaTimeString, manilaToUtc, todayManila } from "./time";
import { daysBetween } from "./billing";
export { followUpsSatisfiedBy, closeFollowUpsForVisit } from "./visits";
import { patientContact, patientContactInclude, renderSavedScript, sendToContact } from "./outreach";

export const FOLLOW_UP_KINDS = [
  { key: "NEXT_SESSION", label: "Next session" },
  { key: "REASSESSMENT", label: "Reassessment" },
  { key: "CHECK_IN", label: "Check-in" },
] as const;
export const FOLLOW_UP_KIND_KEYS = FOLLOW_UP_KINDS.map((k) => k.key) as [string, ...string[]];
export const followUpKindLabel = (k: string) => FOLLOW_UP_KINDS.find((x) => x.key === k)?.label ?? k;

export const FEEDBACK_TTL_DAYS = 14;
export const TESTIMONIAL_CONSENT_VERSION = "2026-10";
export const DISPLAY_NAME_OPTIONS = [
  { key: "FULL", label: "Buong pangalan ko" },
  { key: "INITIAL", label: "First name at initial ng apelyido lang" },
  { key: "ANONYMOUS", label: "Huwag isama ang pangalan ko (anonymous)" },
] as const;

/** The name shown on a testimonial, as the patient chose. */
export function testimonialName(p: { firstName: string; lastName: string | null }, choice: string) {
  if (choice === "FULL") return `${p.firstName} ${p.lastName ?? ""}`.trim();
  if (choice === "ANONYMOUS") return "Anonymous patient";
  return p.lastName ? `${p.firstName} ${p.lastName[0]}.` : p.firstName;
}

export type RecallAction = "DUE" | "OVERDUE" | null;

/**
 * Should a follow-up reminder go out now? (pure; unit-tested)
 * - DUE: first reminder, the day before or on the due date.
 * - OVERDUE: past the due date, repeated every `repeatDays`, at most `maxCount` reminders in total.
 */
export function recallAction(
  fu: { dueDate: string; recallCount: number; lastRecallAt: Date | null },
  now: Date,
  opts: { repeatDays: number; maxCount: number },
): RecallAction {
  const today = manilaDateString(now);
  if (fu.recallCount >= opts.maxCount) return null;
  if (fu.dueDate > addDays(today, 1)) return null;
  if (fu.dueDate >= today) return fu.recallCount === 0 ? "DUE" : null;
  if (fu.lastRecallAt && now.getTime() - fu.lastRecallAt.getTime() < opts.repeatDays * 86_400_000) return null;
  return "OVERDUE";
}

/** A started plan with no session for `gapDays` days. */
export function isStalled(lastVisit: string, today: string, gapDays: number) {
  return daysBetween(lastVisit, today) >= gapDays;
}

export const isDaytime = (now: Date, from = 9, to = 18) => {
  const h = Number(manilaTimeString(now).slice(0, 2));
  return h >= from && h < to;
};

export function followUpStatus(fu: { dueDate: string; status: string }, today = todayManila()) {
  if (fu.status !== "OPEN") return fu.status === "DONE" ? "Done" : "Cancelled";
  if (fu.dueDate < today) return `Overdue ${daysBetween(fu.dueDate, today)}d`;
  if (fu.dueDate === today) return "Due today";
  return `In ${daysBetween(today, fu.dueDate)}d`;
}

/** Patients with a future Booked/Confirmed appointment (they don't need recall messages). */
async function patientsWithUpcoming(patientIds: string[], now: Date) {
  const rows = await db.patient.findMany({
    where: { id: { in: patientIds }, lead: { appointments: { some: { status: { in: ["BOOKED", "CONFIRMED"] }, startAt: { gt: now } } } } },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/** Last visit per patient: latest attended appointment or logged session. */
export async function lastVisits(patientIds?: string[]) {
  const where = patientIds ? { id: { in: patientIds } } : {};
  const patients = await db.patient.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      lead: { select: { appointments: { where: { status: "ATTENDED" }, orderBy: { startAt: "desc" }, take: 1, select: { startAt: true } } } },
      sessions: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
  });
  const out = new Map<string, string | null>();
  for (const p of patients) {
    const appt = p.lead?.appointments[0] ? manilaDateString(p.lead.appointments[0].startAt) : null;
    const sess = p.sessions[0]?.date ?? null;
    out.set(p.id, [appt, sess].filter(Boolean).sort().pop() ?? null);
  }
  return out;
}

/** Recall list: patients with no visit for `days` days and nothing booked. */
export async function inactivePatients(now = new Date()) {
  const days = await getNumberSetting("recallInactiveDays");
  const today = manilaDateString(now);
  const visits = await lastVisits();
  const candidates = [...visits.entries()].filter(([, last]) => last && daysBetween(last, today) > days);
  const booked = await patientsWithUpcoming(candidates.map(([id]) => id), now);
  const ids = candidates.filter(([id]) => !booked.has(id)).map(([id]) => id);
  const patients = await db.patient.findMany({
    where: { id: { in: ids } },
    include: { followUps: { where: { status: "OPEN", kind: "CHECK_IN" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return patients
    .map((p) => ({ patient: p, lastVisit: visits.get(p.id)!, days: daysBetween(visits.get(p.id)!, today), recall: p.followUps[0] ?? null }))
    .sort((a, b) => a.days - b.days);
}

/** Started plans with no session for a while and nothing booked. */
export async function stalledPlans(now = new Date()) {
  const gap = await getNumberSetting("stalledPlanDays");
  const today = manilaDateString(now);
  const plans = await db.treatmentPlan.findMany({
    where: { status: "STARTED" },
    include: { patient: true, sessions: { orderBy: { date: "desc" }, take: 1, select: { date: true } } },
  });
  const rows = plans
    .map((p) => ({ plan: p, lastVisit: p.sessions[0]?.date ?? manilaDateString(p.startedAt ?? p.createdAt) }))
    .filter((r) => isStalled(r.lastVisit, today, gap));
  const booked = await patientsWithUpcoming(rows.map((r) => r.plan.patientId), now);
  return rows.filter((r) => !booked.has(r.plan.patientId)).map((r) => ({ ...r, days: daysBetween(r.lastVisit, today) }));
}

const SCRIPT_FOR_ACTION = { DUE: "follow_up_due", OVERDUE: "recall_overdue" } as const;

/** Send one follow-up reminder now and record the result. */
export async function sendFollowUpReminder(followUpId: string, action: "DUE" | "OVERDUE" | "INACTIVE" | "MISSED", now = new Date()) {
  const fu = await db.followUp.findUniqueOrThrow({ where: { id: followUpId }, include: { patient: { include: patientContactInclude } } });
  const key = action === "INACTIVE" ? "recall_inactive" : action === "MISSED" ? "missed_session" : SCRIPT_FOR_ACTION[action];
  const text = await renderSavedScript(key, { first_name: fu.patient.firstName, date: formatDate(manilaToUtc(fu.dueDate, "12:00")) });
  const r = await sendToContact(patientContact(fu.patient), text, { subject: "Clinica Medica 101: follow-up", now });
  await db.followUp.update({
    where: { id: fu.id },
    data: {
      recallCount: { increment: 1 }, lastRecallAt: now,
      lastRecallChannel: r.channel, lastRecallError: r.ok ? null : r.error,
    },
  });
  await audit({ action: "SEND", entity: "FollowUp", entityId: fu.id, detail: `${action} via ${r.channel}` });
  return r;
}

export function newFeedbackToken() {
  return randomBytes(24).toString("base64url");
}

/** Create a feedback link for a visit and send it. */
export async function requestFeedback(patientId: string, appointmentId: string | null, now = new Date()) {
  const patient = await db.patient.findUniqueOrThrow({ where: { id: patientId }, include: patientContactInclude });
  const fb = await db.feedback.create({
    data: { token: newFeedbackToken(), patientId, appointmentId, expiresAt: new Date(now.getTime() + FEEDBACK_TTL_DAYS * 86_400_000) },
  });
  const link = `${process.env.APP_URL ?? ""}/feedback/${fb.token}`;
  const text = await renderSavedScript("feedback_request", { first_name: patient.firstName }, link);
  const r = await sendToContact(patientContact(patient), text, { subject: "Clinica Medica 101: kumusta ang inyong visit?", now });
  await db.feedback.update({ where: { id: fb.id }, data: { sentChannel: r.channel, sentError: r.ok ? null : r.error } });
  return { feedback: fb, link, result: r };
}

/** Run by the reminders cron: follow-up reminders, missed-session recalls, feedback requests. Daytime only. */
export async function runFollowUps(now = new Date()) {
  const summary = { followUps: 0, stalled: 0, feedback: 0 };
  if (!isDaytime(now)) return summary;
  const today = manilaDateString(now);

  if ((await getSetting("recallEnabled")) === "1") {
    const opts = { repeatDays: await getNumberSetting("recallRepeatDays"), maxCount: await getNumberSetting("recallMaxCount") };
    const open = await db.followUp.findMany({ where: { status: "OPEN", dueDate: { lte: addDays(today, 1) } } });
    const booked = await patientsWithUpcoming([...new Set(open.map((f) => f.patientId))], now);
    for (const fu of open) {
      if (booked.has(fu.patientId)) continue;
      const action = recallAction(fu, now, opts);
      if (!action) continue;
      await sendFollowUpReminder(fu.id, action, now);
      summary.followUps++;
    }

    const gap = await getNumberSetting("stalledPlanDays");
    for (const { plan } of await stalledPlans(now)) {
      if (plan.recallSentAt && now.getTime() - plan.recallSentAt.getTime() < gap * 86_400_000) continue;
      const planned = await db.followUp.count({ where: { patientId: plan.patientId, status: "OPEN", dueDate: { gte: today } } });
      if (planned) continue; // the doctor already set a later follow-up date
      const patient = await db.patient.findUniqueOrThrow({ where: { id: plan.patientId }, include: patientContactInclude });
      const text = await renderSavedScript("missed_session", { first_name: patient.firstName });
      const r = await sendToContact(patientContact(patient), text, { subject: "Clinica Medica 101: susunod na session", now });
      await db.treatmentPlan.update({ where: { id: plan.id }, data: { recallSentAt: now } });
      await audit({ action: "SEND", entity: "TreatmentPlan", entityId: plan.id, detail: `missed-session recall via ${r.channel}` });
      summary.stalled++;
    }
  }

  if ((await getSetting("feedbackEnabled")) === "1") {
    const every = await getNumberSetting("feedbackEveryDays");
    const visits = await db.appointment.findMany({
      where: {
        status: "ATTENDED", feedback: null,
        endAt: { lt: new Date(now.getTime() - 2 * 3_600_000), gt: new Date(now.getTime() - 3 * 86_400_000) },
        lead: { patient: { isNot: null } },
      },
      include: { lead: { select: { patient: { select: { id: true } } } } },
    });
    for (const v of visits) {
      const patientId = v.lead.patient!.id;
      const recent = await db.feedback.count({ where: { patientId, createdAt: { gt: new Date(now.getTime() - every * 86_400_000) } } });
      if (recent) continue;
      await requestFeedback(patientId, v.id, now);
      summary.feedback++;
    }
  }
  return summary;
}
