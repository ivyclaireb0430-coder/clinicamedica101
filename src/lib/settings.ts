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
