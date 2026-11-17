import { db } from "../db";
import { decrypt } from "../crypto";
import { getNumberSetting, getSetting, setSetting } from "../settings";
import { formatPhp, todayManila } from "../time";
import { aiConfigured, factsText, type HistoryLine } from "./ai";

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
