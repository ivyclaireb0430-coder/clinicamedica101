import { db } from "./db";

export const SETTING_DEFAULTS = {
  followUpDays: "3", // leads with no booking after N days go to "Needs follow-up"
  clinicName: "Clinica Medica 101 Center for Complementary Medicine",
  clinicAddress: "Centuria Medical Makati, Kalayaan Ave cor. Salamanca St, Makati City",
  automationEnabled: "1", // Messenger auto-replies on/off
  remindersEnabled: "1",
  smsEnabled: "1", // owner approved SMS; only sends once SEMAPHORE_API_KEY is set
  utilityTemplateName: "", // approved Messenger UTILITY template for reminders outside 24h
  utilityTemplateLanguage: "en_US",
  autoNoShowHours: "3", // hours after the appointment ends before it is auto-marked No-show
  lastDoctorNotifyAt: "",
  // Phase 4: follow-up and billing
  recallEnabled: "1", // automatic follow-up / missed-session reminders
  recallRepeatDays: "7", // days between reminders for an overdue follow-up
  recallMaxCount: "3", // stop after this many reminders for one follow-up
  stalledPlanDays: "14", // started plan with no session for N days = missed session
  recallInactiveDays: "90", // recall list: no visit for N days
  feedbackEnabled: "1",
  feedbackEveryDays: "30", // ask the same patient for feedback at most once every N days
  receiptHeader: "", // e.g. registered name, TIN, address for the acknowledgement receipt
  // Phase 5: Monday summary email
  weeklyEmailEnabled: "1",
  weeklyEmailTo: "", // blank = the connected Google account / owner email
  lastWeeklyEmailWeek: "", // Monday of the last week already emailed
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key];
}

export async function getNumberSetting(key: SettingKey): Promise<number> {
  const n = Number(await getSetting(key));
  return Number.isFinite(n) ? n : Number(SETTING_DEFAULTS[key]);
}

export async function setSetting(key: SettingKey, value: string) {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
