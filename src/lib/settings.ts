import { db } from "./db";

export const SETTING_DEFAULTS = {
  followUpDays: "3", // leads with no booking after N days go to "Needs follow-up"
  clinicName: "Clinica Medica 101 Center for Integrative Medicine",
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
  // Phase 6: retention policy (records past these ages are listed for review, never deleted automatically)
  retentionPatientYears: "10", // after the last visit
  retentionLeadMonths: "24", // inquiries that never became patients, after last contact
  // Sales funnel: public landing page at /start (placeholder text; the owner edits it in Settings → Landing page)
  landingEnabled: "1",
  landingHeadline: "Matagal na bang may iniinda? Hanapin natin ang ugat, hindi lang ang sintomas.",
  landingSubheadline:
    "Integrative medicine consultation sa Centuria Medical Makati. Isang doktor na makikinig sa buong kwento ninyo at gagawa ng plano para sa inyo.",
  landingOffer: "PROMO: Vector Scan ₱3,000 na lang (dati ₱16,000), dagdag sa consultation fee.", // highlighted banner in the hero; blank hides it
  // Featured service/promo section; blank name hides it. Prices are whole pesos.
  landingPromoName: "Vector Scan",
  landingPromoOldPrice: "16000",
  landingPromoPrice: "3000",
  landingPromoDesc:
    "Isang non-invasive na scan na bahagi ng integrative assessment ni Dr. Lim. Tumutulong itong makita ang mas buong larawan ng inyong kalusugan, para mas tugma sa inyo ang plano. Hiwalay ang consultation fee.",
  landingBenefits:
    "Mahabang consultation, hindi minamadali\nPlano na swak sa inyong kondisyon at budget\nMay follow-up para masubaybayan ang progress ninyo\nNasa Makati, malapit sa Kalayaan Ave",
  landingFaq:
    "Magkano ang consultation? | ₱1,000 ang initial consultation at follow-up. ₱800 para sa Senior Citizens at PWD (dalhin lang ang ID). Sasabihin din namin bago kayo mag-book, walang sorpresa.\nKailangan ba ng referral? | Hindi po. Pwede kayong mag-inquire at mag-book nang direkta.\nPaano kung may iniinom na akong gamot? | Dalhin po ang listahan ng gamot ninyo. Hindi namin kayo pahihintuin nang walang usapan.",
  landingCta: "Mag-book ng consultation ngayon",
  landingDoctorName: "Dr. Irene Lim",
  landingDoctorTitle: "Doctor, Clinica Medica 101 Center for Integrative Medicine",
  landingDoctorBio:
    "Si Dr. Irene Lim ang personal na humaharap sa bawat consultation. Pinakikinggan niya ang buong kwento ninyo, tinitingnan ang inyong lab results at mga gamot, at ipinapaliwanag nang malinaw ang plano bago kayo magsimula.",
  landingFeeNote: "Senior Citizens at PWD: ₱800 sa initial consultation at follow-up. Dalhin lang ang inyong Senior o PWD ID.",
  // English versions for the /en funnel pages
  landingDoctorBioEn:
    "Dr. Irene Lim personally sees every patient. She listens to your whole story, reviews your lab results and medicines, and explains the plan clearly before you start.",
  landingPromoDescEn:
    "A non-invasive scan that is part of Dr. Lim's integrative assessment. It helps build a fuller picture of your health so your plan fits you better. The consultation fee is separate.",
  landingFeeNoteEn: "Senior Citizens and PWDs: ₱800 for the initial consultation and follow-ups. Just bring your Senior or PWD ID.",
  landingShowFees: "1", // list active consultation types and fees
  landingShowTestimonials: "1", // feedback with testimonial consent, 4–5 stars, not hidden
  lastWebLeadNotifyAt: "",
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
