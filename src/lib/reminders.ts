import { db } from "./db";
import { getNumberSetting, getSetting } from "./settings";
import { renderScript } from "./scripts";
import { formatDate, formatTime, manilaDateString, manilaTimeString, addDays } from "./time";
import { scriptBody, sendToContact } from "./outreach";
import { audit } from "./audit";

export type ReminderKind = "CONFIRMATION" | "DAY_BEFORE" | "DAY_OF" | "NO_SHOW";

const SCRIPT_FOR: Record<ReminderKind, string> = {
  CONFIRMATION: "booking_confirm",
  DAY_BEFORE: "reminder_day_before",
  DAY_OF: "reminder_day_of",
  NO_SHOW: "no_show_rebook",
};

type Appt = {
  id: string;
  startAt: Date;
  createdAt: Date;
  lead: { id: string; firstName: string; email: string | null; mobile: string | null; conversation: { id: string; psid: string; lastUserMessageAt: Date | null } | null };
};

/** Which reminders are due for an appointment right now (pure; unit-tested). */
export function dueReminderKinds(
  appt: { startAt: Date; createdAt: Date; status: string },
  sent: ReminderKind[],
  now: Date,
): ReminderKind[] {
  if (!["BOOKED", "CONFIRMED"].includes(appt.status) || appt.startAt <= now) return [];
  const due: ReminderKind[] = [];
  const today = manilaDateString(now);
  const apptDay = manilaDateString(appt.startAt);
  const hour = Number(manilaTimeString(now).slice(0, 2));
  const daytime = hour >= 8 && hour < 20; // don't message patients at night

  if (!sent.includes("CONFIRMATION") && hour >= 7 && hour < 21) due.push("CONFIRMATION");
  const bookedLongAgo = now.getTime() - appt.createdAt.getTime() > 12 * 3_600_000;
  if (!sent.includes("DAY_BEFORE") && apptDay === addDays(today, 1) && daytime && bookedLongAgo) due.push("DAY_BEFORE");
  if (
    !sent.includes("DAY_OF") && apptDay === today && hour >= 7 &&
    appt.startAt.getTime() - now.getTime() > 45 * 60_000 && manilaDateString(appt.createdAt) !== today
  ) due.push("DAY_OF");
  return due;
}

/** Send one appointment reminder through the channel chain in outreach.ts. */
export async function sendAppointmentMessage(appt: Appt, kind: ReminderKind, now = new Date()) {
  const values = { first_name: appt.lead.firstName, date: formatDate(appt.startAt), time: formatTime(appt.startAt) };
  const body = (await scriptBody(SCRIPT_FOR[kind])) || "Paalala po ng inyong appointment sa {date}, {time}.";
  const text = renderScript(body, values);
  return sendToContact(appt.lead, text, {
    subject: "Clinica Medica 101: inyong appointment",
    // Utility templates are for appointment updates only, not the no-show re-booking message.
    templateParams: kind === "NO_SHOW" ? undefined : [values.first_name, values.date, values.time],
    now,
  });
}

const apptInclude = {
  lead: {
    select: {
      id: true, firstName: true, email: true, mobile: true,
      conversation: { select: { id: true, psid: true, lastUserMessageAt: true } },
    },
  },
  reminders: { select: { kind: true } },
} as const;

async function record(appointmentId: string, kind: ReminderKind, r: { channel: string; ok: boolean; error?: string }) {
  await db.reminder.upsert({
    where: { appointmentId_kind: { appointmentId, kind } },
    create: { appointmentId, kind, channel: r.channel, status: r.ok ? "SENT" : r.channel === "NONE" ? "NO_CHANNEL" : "FAILED", error: r.error },
    update: { channel: r.channel, status: r.ok ? "SENT" : "FAILED", error: r.error },
  });
}

/** Run by cron every 15 minutes. */
export async function runReminders(now = new Date()) {
  const summary = { sent: 0, failed: 0, noShows: 0 };
  if ((await getSetting("remindersEnabled")) !== "1") return summary;

  const upcoming = await db.appointment.findMany({
    where: { status: { in: ["BOOKED", "CONFIRMED"] }, startAt: { gt: now, lt: new Date(now.getTime() + 3 * 86_400_000) } },
    include: apptInclude,
  });
  for (const appt of upcoming) {
    for (const kind of dueReminderKinds(appt, appt.reminders.map((r) => r.kind as ReminderKind), now)) {
      const r = await sendAppointmentMessage(appt, kind, now);
      await record(appt.id, kind, r);
      r.ok ? summary.sent++ : summary.failed++;
    }
  }

  // Automatic no-show: still Booked/Confirmed a few hours after the end time.
  const hours = await getNumberSetting("autoNoShowHours");
  const cutoff = new Date(now.getTime() - hours * 3_600_000);
  const missed = await db.appointment.findMany({
    where: { status: { in: ["BOOKED", "CONFIRMED"] }, endAt: { lt: cutoff, gt: new Date(now.getTime() - 3 * 86_400_000) } },
    include: apptInclude,
  });
  for (const appt of missed) {
    await db.appointment.update({ where: { id: appt.id }, data: { status: "NO_SHOW", noShowAutoMarked: true } });
    await audit({ action: "UPDATE", entity: "Appointment", entityId: appt.id, detail: "auto no-show" });
    summary.noShows++;
  }

  // Re-booking message for auto-detected no-shows, sent in the daytime only.
  const hour = Number(manilaTimeString(now).slice(0, 2));
  if (hour >= 8 && hour < 20) {
    const toRebook = await db.appointment.findMany({
      where: {
        status: "NO_SHOW", noShowAutoMarked: true, reminders: { none: { kind: "NO_SHOW" } },
        endAt: { gt: new Date(now.getTime() - 3 * 86_400_000) },
      },
      include: apptInclude,
    });
    for (const appt of toRebook) {
      const r = await sendAppointmentMessage(appt, "NO_SHOW", now);
      await record(appt.id, "NO_SHOW", r);
    }
  }
  return summary;
}
