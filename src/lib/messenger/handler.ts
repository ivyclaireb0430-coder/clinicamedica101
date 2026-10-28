import { db } from "../db";
import { encrypt } from "../crypto";
import { audit } from "../audit";
import { getSetting } from "../settings";
import { formatDate, formatPhp, formatTime, todayManila, addDays } from "../time";
import { getOpenSlots, createAppointment, rescheduleAppointment, setAppointmentStatus, advanceLeadStage, SlotTakenError } from "../booking";
import { notifyDoctor } from "../notify";
import { fetchProfile, sendText, type OutMessage } from "./meta";
import { handleMessage, parseState, type BotDeps, type FlowState, type Slot } from "./bot";

const SLOTS_PER_PAGE = 6;
const SLOT_SEARCH_DAYS = 14;
const HANDOFF_QUIET_MS = 12 * 60 * 60 * 1000;

export type MessagingEvent = {
  sender: { id: string };
  recipient: { id: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; app_id?: number; quick_reply?: { payload?: string } };
  postback?: { payload?: string; title?: string; referral?: { ref?: string } };
  referral?: { ref?: string };
};

const shortDay = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });

export function slotLabel(d: Date): string {
  // Fits Messenger's 20-character quick reply limit, e.g. "Thu, Oct 29 10:00 AM".
  return `${shortDay.format(d)} ${formatTime(d)}`.replace(/\s+/g, " ").slice(0, 20);
}

async function campaignForRef(ref?: string) {
  if (!ref) return null;
  return db.campaign.findUnique({ where: { trackingCode: ref.toLowerCase() } });
}

async function findOrCreateConversation(psid: string, ref?: string) {
  const existing = await db.conversation.findUnique({ where: { psid }, include: { lead: true } });
  if (existing) {
    if (ref && !existing.lead.campaignId) {
      const campaign = await campaignForRef(ref);
      if (campaign) await db.lead.update({ where: { id: existing.leadId }, data: { campaignId: campaign.id } });
    }
    return { conversation: existing, isNew: false };
  }
  const [profile, campaign] = await Promise.all([fetchProfile(psid), campaignForRef(ref)]);
  const lead =
    (await db.lead.findUnique({ where: { psid } })) ??
    (await db.lead.create({
      data: {
        firstName: profile.firstName || "Messenger user",
        lastName: profile.lastName,
        psid,
        source: campaign ? channelToSource(campaign.channel) : "MESSENGER",
        campaignId: campaign?.id ?? null,
        stageChanges: { create: { toStage: "NEW" } },
      },
    }));
  const conversation = await db.conversation.create({ data: { psid, leadId: lead.id }, include: { lead: true } });
  await audit({ action: "CREATE", entity: "Lead", entityId: lead.id, detail: "from Messenger" });
  return { conversation, isNew: true };
}

function channelToSource(channel: string) {
  return ["FB_REEL", "FB_POST", "RADIO", "REFERRAL"].includes(channel) ? channel : "MESSENGER";
}

export async function storeOutgoing(conversationId: string, text: string, sender: "BOT" | "DOCTOR", result: { message_id?: string; error?: string }) {
  await db.message.create({
    data: {
      conversationId,
      direction: "OUT",
      sender,
      textEnc: encrypt(text),
      mid: result.message_id ?? null,
      status: result.error ? "FAILED" : "SENT",
      error: result.error,
    },
  });
  await db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
}

async function sendBotReplies(conversationId: string, psid: string, replies: OutMessage[]) {
  for (const reply of replies) {
    const result = await sendText(psid, reply);
    await storeOutgoing(conversationId, reply.text, "BOT", result);
  }
}

export async function handleEvent(event: MessagingEvent): Promise<void> {
  const msg = event.message;

  // Echo = a message the Page sent. If it wasn't sent by this app, the doctor replied from the
  // Facebook Page inbox: record it and pause automation (human takeover).
  if (msg?.is_echo) {
    const psid = event.recipient.id;
    if (msg.app_id && String(msg.app_id) === process.env.META_APP_ID) return;
    if (msg.mid && (await db.message.findUnique({ where: { mid: msg.mid } }))) return;
    const conversation = await db.conversation.findUnique({ where: { psid } });
    if (!conversation) return;
    await db.message.create({
      data: { conversationId: conversation.id, direction: "OUT", sender: "PAGE", textEnc: encrypt(msg.text ?? "[attachment]"), mid: msg.mid },
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { automationPaused: true, pausedAt: new Date(), needsDoctor: false, lastMessageAt: new Date(), flowState: null },
    });
    return;
  }

  const psid = event.sender.id;
  if (psid === process.env.META_PAGE_ID) return;
  if (msg?.mid && (await db.message.findUnique({ where: { mid: msg.mid } }))) return; // webhook retry

  const ref = event.referral?.ref ?? event.postback?.referral?.ref;
  const payload = msg?.quick_reply?.payload ?? event.postback?.payload;
  const text = msg?.text;
  if (!text && !payload && !ref) return; // stickers, reads, deliveries

  const { conversation, isNew } = await findOrCreateConversation(psid, ref);
  const now = new Date();
  if (text || payload) {
    await db.message.create({
      data: {
        conversationId: conversation.id,
        direction: "IN",
        sender: "PATIENT",
        textEnc: encrypt(text ?? event.postback?.title ?? payload ?? ""),
        mid: msg?.mid ?? null,
      },
    });
  }
  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastUserMessageAt: now, lastMessageAt: now, unread: { increment: 1 } },
  });
  await db.lead.update({ where: { id: conversation.leadId }, data: { lastContactAt: now } });

  if ((await getSetting("automationEnabled")) !== "1" || conversation.automationPaused) return;

  const lead = conversation.lead;
  const upcoming = await db.appointment.findFirst({
    where: { leadId: lead.id, status: { in: ["BOOKED", "CONFIRMED"] }, startAt: { gt: now } },
    orderBy: { startAt: "asc" },
  });
  const [scripts, types] = await Promise.all([
    db.script.findMany({ select: { key: true, body: true } }),
    db.consultationType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const deps = makeDeps(conversation.id, lead.id);
  const state: FlowState = parseState(conversation.flowState);
  const result = await handleMessage(
    {
      firstName: lead.firstName === "Messenger user" ? "po" : lead.firstName,
      hasFullName: Boolean(lead.lastName) && lead.firstName !== "Messenger user",
      privacyConsent: lead.privacyConsent,
      mobile: lead.mobile,
      isNewConversation: isNew,
      upcoming: upcoming
        ? { id: upcoming.id, status: upcoming.status, dateLabel: formatDate(upcoming.startAt), timeLabel: formatTime(upcoming.startAt) }
        : null,
      recentlyHandedOff: Boolean(conversation.needsDoctor && conversation.needsDoctorAt && now.getTime() - conversation.needsDoctorAt.getTime() < HANDOFF_QUIET_MS),
      scripts: Object.fromEntries(scripts.map((s) => [s.key, s.body])),
      consultationTypes: types.map((t) => ({ id: t.id, name: t.name, feeLabel: formatPhp(t.feePhp) })),
      privacyUrl: `${process.env.APP_URL ?? ""}/privacy`,
    },
    state,
    { text, payload },
    deps,
  );

  await db.conversation.update({
    where: { id: conversation.id },
    data: { flowState: result.state.step === "IDLE" ? null : JSON.stringify(result.state) },
  });
  await sendBotReplies(conversation.id, psid, result.replies);
}

function makeDeps(conversationId: string, leadId: string): BotDeps {
  return {
    async slots(typeId, page) {
      const wanted = (page + 1) * SLOTS_PER_PAGE + 1;
      const found: Slot[] = [];
      for (let i = 0; i < SLOT_SEARCH_DAYS && found.length < wanted; i++) {
        const day = addDays(todayManila(), i);
        const open = await getOpenSlots(day, typeId);
        // Offer at most 3 times per day so patients see a spread of days.
        const spread = open.length > 3 ? [open[0], open[Math.floor(open.length / 2)], open[open.length - 1]] : open;
        found.push(...spread.map((s) => ({ startAt: s.startAt, label: slotLabel(s.startAt) })));
      }
      const pageSlots = found.slice(page * SLOTS_PER_PAGE, (page + 1) * SLOTS_PER_PAGE);
      return { slots: pageSlots, hasMore: found.length > (page + 1) * SLOTS_PER_PAGE };
    },
    async book({ typeId, startAt, rescheduleId }) {
      try {
        const appt = rescheduleId
          ? await rescheduleAppointment(rescheduleId, startAt, null)
          : await createAppointment({ leadId, consultationTypeId: typeId, startAt, channel: "MESSENGER" });
        if (rescheduleId) await db.appointment.update({ where: { id: appt.id }, data: { channel: "MESSENGER" } });
        // The bot sends the confirmation itself; record it so the reminder job doesn't repeat it.
        await db.reminder.create({ data: { appointmentId: appt.id, kind: "CONFIRMATION", channel: "MESSENGER", status: "SENT" } });
        return { ok: true, dateLabel: formatDate(appt.startAt), timeLabel: formatTime(appt.startAt) };
      } catch (err) {
        if (err instanceof SlotTakenError) return { ok: false };
        throw err;
      }
    },
    async confirmAppointment(id) {
      await setAppointmentStatus(id, "CONFIRMED", null);
    },
    async recordConsent() {
      await db.lead.update({ where: { id: leadId }, data: { privacyConsent: true, consentAt: new Date() } });
      await audit({ action: "UPDATE", entity: "Lead", entityId: leadId, detail: "privacy consent via Messenger" });
    },
    async saveName(full) {
      const [first, ...rest] = full.trim().split(/\s+/);
      await db.lead.update({ where: { id: leadId }, data: { firstName: first, lastName: rest.join(" ") || null } });
    },
    async saveMobile(mobile) {
      await db.lead.update({ where: { id: leadId }, data: { mobile } });
    },
    async handoff() {
      await db.conversation.update({ where: { id: conversationId }, data: { needsDoctor: true, needsDoctorAt: new Date() } });
      await notifyDoctor();
    },
    async setStage(stage) {
      await advanceLeadStage(leadId, stage, null);
    },
  };
}
