import { db } from "./db";
import { getSetting, setSetting } from "./settings";
import { doctorEmail, sendGmail } from "./google";

const NOTIFY_THROTTLE_MS = 30 * 60 * 1000;

/**
 * Tell the doctor that Messenger conversations need a personal reply.
 * Contains no patient names or messages — only a count and a link. Throttled to once per 30 minutes.
 */
export async function notifyDoctor(now = new Date()): Promise<void> {
  const last = await getSetting("lastDoctorNotifyAt");
  if (last && now.getTime() - new Date(last).getTime() < NOTIFY_THROTTLE_MS) return;
  const to = await doctorEmail();
  if (!to) return;
  const count = await db.conversation.count({ where: { needsDoctor: true } });
  const result = await sendGmail(
    to,
    `Clinica Medica 101: ${count} Messenger ${count === 1 ? "conversation needs" : "conversations need"} your reply`,
    `May ${count} na mensahe sa Messenger na kailangan ng sagot ng doktor.\n\nBuksan ang inbox: ${process.env.APP_URL ?? ""}/inbox\n\n(Walang patient details sa email na ito para sa privacy.)`,
  ).catch(() => ({ ok: false }));
  if (result.ok) await setSetting("lastDoctorNotifyAt", now.toISOString());
}
