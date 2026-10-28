import { db } from "./db";
import { renderScript } from "./scripts";
import { sendGmail } from "./google";
import { sendSms, smsEnabled } from "./sms";
import { sendText, sendUtilityTemplate, withinWindow } from "./messenger/meta";
import { storeOutgoing } from "./messenger/handler";
import { getSetting } from "./settings";
import { SCRIPTS as DEFAULT_SCRIPTS } from "../../prisma/seed-data";

export type Contact = {
  firstName: string;
  email: string | null;
  mobile: string | null;
  conversation: { id: string; psid: string; lastUserMessageAt: Date | null } | null;
};

export type SendResult = { channel: string; ok: boolean; error?: string };

/** Saved script body by key, falling back to the built-in default if it was never saved. */
export async function scriptBody(key: string): Promise<string> {
  const row = await db.script.findUnique({ where: { key } });
  return row?.body ?? DEFAULT_SCRIPTS.find((s) => s.key === key)?.body ?? "";
}

export async function renderSavedScript(key: string, values: Record<string, string>, link?: string) {
  const text = renderScript(await scriptBody(key), values);
  return link ? text.replace("[link]", link) : text;
}

/**
 * Send a non-clinical message, trying channels in order:
 * Messenger inside the 24-hour window → Messenger utility template (appointment reminders only) → email → SMS.
 */
export async function sendToContact(
  contact: Contact,
  text: string,
  opts: { subject: string; templateParams?: string[]; now?: Date },
): Promise<SendResult> {
  const now = opts.now ?? new Date();
  const convo = contact.conversation;
  const errors: string[] = [];

  if (convo && withinWindow(convo.lastUserMessageAt, now)) {
    const r = await sendText(convo.psid, { text });
    await storeOutgoing(convo.id, text, "BOT", r);
    if (!r.error) return { channel: "MESSENGER", ok: true };
    errors.push(r.error);
  }
  const template = opts.templateParams ? await getSetting("utilityTemplateName") : "";
  if (convo && template && opts.templateParams) {
    const r = await sendUtilityTemplate(convo.psid, template, await getSetting("utilityTemplateLanguage"), opts.templateParams);
    await storeOutgoing(convo.id, `[Reminder template] ${text}`, "BOT", r);
    if (!r.error) return { channel: "MESSENGER_UTILITY", ok: true };
    errors.push(r.error);
  }
  if (contact.email) {
    const r = await sendGmail(contact.email, opts.subject, `${text}\n\nClinica Medica 101\nCenturia Medical Makati`);
    if (r.ok) return { channel: "EMAIL", ok: true };
    errors.push(r.error ?? "email failed");
  }
  if (contact.mobile && (await smsEnabled())) {
    const r = await sendSms(contact.mobile, `Clinica Medica 101: ${text}`);
    if (r.ok) return { channel: "SMS", ok: true };
    errors.push(r.error ?? "sms failed");
  }
  return { channel: errors.length ? "FAILED" : "NONE", ok: false, error: errors.join("; ") || "No channel available" };
}

const convoSelect = { select: { id: true, psid: true, lastUserMessageAt: true } } as const;

/** Patient include that carries what `patientContact` needs. */
export const patientContactInclude = {
  lead: { select: { email: true, mobile: true, conversation: convoSelect } },
} as const;

export function patientContact(p: {
  firstName: string;
  email: string | null;
  mobile: string | null;
  lead: { email: string | null; mobile: string | null; conversation: Contact["conversation"] } | null;
}): Contact {
  return {
    firstName: p.firstName,
    email: p.email ?? p.lead?.email ?? null,
    mobile: p.mobile ?? p.lead?.mobile ?? null,
    conversation: p.lead?.conversation ?? null,
  };
}
