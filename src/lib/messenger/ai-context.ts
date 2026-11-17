import { db } from "../db";
import { decrypt, decryptOptional, encrypt, encryptOptional } from "../crypto";
import { getNumberSetting, getSetting, setSetting } from "../settings";
import { formatPhp, todayManila } from "../time";
import { aiConfigured, factsText, type HistoryLine, type StyleExample } from "./ai";
import { extractPairs, replyHash, type ExamplePair, type ThreadLine } from "./ai-examples";
import { fetchPageThreads } from "./meta";

/** AI replies are on: switched on in Settings and an API key is set on the server. */
export async function aiEnabled(): Promise<boolean> {
  return aiConfigured() && (await getSetting("aiRepliesEnabled")) === "1";
}

/** Count one AI reply against today's cap. Returns false when the cap is reached. */
export async function takeAiQuota(): Promise<boolean> {
  const today = todayManila();
  const [day, count] = (await getSetting("aiUsage")).split(":");
  const used = day === today ? Number(count) || 0 : 0;
  if (used >= (await getNumberSetting("aiDailyLimit"))) return false;
  await setSetting("aiUsage", `${today}:${used + 1}`);
  return true;
}

export async function aiUsageToday(): Promise<number> {
  const today = todayManila();
  const [day, count] = (await getSetting("aiUsage")).split(":");
  return day === today ? Number(count) || 0 : 0;
}

/** Clinic facts the AI may use, from Settings, consultation types and scripts. */
export async function loadClinicFacts(): Promise<string> {
  const keys = [
    "clinicName", "clinicAddress", "clinicPhone", "clinicHours", "clinicHoursEn", "landingDoctorName", "landingFeeNote",
    "landingOffer", "landingPromoName", "landingPromoOldPrice", "landingPromoPrice", "landingPromoDescEn", "siteServicesEn", "landingFaq",
  ] as const;
  const values = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await getSetting(k)] as const))) as Record<(typeof keys)[number], string>;
  const [types, scripts] = await Promise.all([
    db.consultationType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.script.findMany({ select: { key: true, body: true } }),
  ]);
  return factsText({
    clinicName: values.clinicName,
    address: values.clinicAddress,
    phone: values.clinicPhone,
    hours: values.clinicHours,
    hoursEn: values.clinicHoursEn,
    doctorName: values.landingDoctorName,
    consultationTypes: types.map((t) => ({ name: t.name, feeLabel: formatPhp(t.feePhp) })),
    feeNote: values.landingFeeNote,
    offer: values.landingOffer,
    promo: values.landingPromoName
      ? { name: values.landingPromoName, oldPrice: values.landingPromoOldPrice, price: values.landingPromoPrice, desc: values.landingPromoDescEn }
      : null,
    services: values.siteServicesEn,
    faq: values.landingFaq,
    scripts: Object.fromEntries(scripts.map((s) => [s.key, s.body])),
  });
}

/** Recent messages of a conversation, oldest first (includes the message just received). */
export async function loadHistory(conversationId: string, take = 8): Promise<HistoryLine[]> {
  const rows = await db.message.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take });
  return rows.reverse().map((m) => ({ from: m.direction === "IN" ? "patient" : "clinic", text: decrypt(m.textEnc) }));
}

const MAX_STYLE_EXAMPLES = 25;

/** Owner-approved past replies, newest first, for the AI to copy the clinic's tone. */
export async function loadStyleExamples(): Promise<StyleExample[]> {
  const rows = await db.aiExample.findMany({ where: { approved: true }, orderBy: { repliedAt: "desc" }, take: MAX_STYLE_EXAMPLES });
  return rows.map((r) => ({ question: decryptOptional(r.questionEnc), reply: decrypt(r.replyEnc) }));
}

/**
 * Collect anonymized past clinic replies as example candidates (not approved yet).
 * Sources: replies typed by staff in the app inbox or the Facebook Page inbox, and (optionally) the Page's
 * older Messenger history from Facebook. Replies sent by the bot or the AI are skipped.
 */
export async function collectStyleExamples(opts: { facebook: boolean }): Promise<{ added: number; error?: string }> {
  // Hashes of bot/AI texts, so automated replies aren't learned as "staff style".
  const botRows = await db.message.findMany({ where: { sender: { in: ["BOT", "AI"] } }, orderBy: { createdAt: "desc" }, take: 3000, select: { textEnc: true } });
  const skip = new Set(botRows.map((m) => replyHash(decrypt(m.textEnc))));
  const existing = new Set((await db.aiExample.findMany({ select: { replyHash: true } })).map((e) => e.replyHash));
  const pairs: { pair: ExamplePair; source: string }[] = [];

  const convos = await db.conversation.findMany({
    where: { messages: { some: { sender: { in: ["DOCTOR", "PAGE"] } } } },
    orderBy: { lastMessageAt: "desc" },
    take: 300,
    include: { lead: { select: { firstName: true, lastName: true } }, messages: { orderBy: { createdAt: "asc" }, take: 200 } },
  });
  for (const c of convos) {
    const lines: ThreadLine[] = c.messages
      .filter((m) => m.sender !== "BOT" && m.sender !== "AI")
      .map((m) => ({ fromClinic: m.direction === "OUT", text: decrypt(m.textEnc), at: m.createdAt }));
    const names = [c.lead.firstName, c.lead.lastName ?? ""].filter((n) => n && n !== "Messenger user");
    for (const pair of extractPairs(lines, names, skip)) pairs.push({ pair, source: "INBOX" });
  }

  let error: string | undefined;
  if (opts.facebook) {
    const fb = await fetchPageThreads();
    error = fb.error;
    for (const t of fb.threads) {
      const lines = t.messages.map((m) => ({ fromClinic: m.fromPage, text: m.text, at: m.at }));
      for (const pair of extractPairs(lines, t.participantNames, skip)) pairs.push({ pair, source: "FACEBOOK" });
    }
  }

  let added = 0;
  for (const { pair, source } of pairs) {
    if (existing.has(pair.hash)) continue;
    existing.add(pair.hash);
    await db.aiExample.create({
      data: { questionEnc: encryptOptional(pair.question), replyEnc: encrypt(pair.reply), replyHash: pair.hash, source, repliedAt: pair.at },
    });
    added++;
  }
  return { added, error };
}
