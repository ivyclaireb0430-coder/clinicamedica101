import { db } from "./db";

export const SETTING_DEFAULTS = {
  followUpDays: "3", // leads with no booking after N days go to "Needs follow-up"
  clinicName: "Clinica Medica 101 Center for Complementary Medicine",
  clinicAddress: "Centuria Medical Makati, Kalayaan Ave cor. Salamanca St, Makati City",
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
