"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { isRole } from "@/lib/roles";
import { pullFromGoogle } from "@/lib/google";
import { createReminderTemplate } from "@/lib/messenger/meta";
import { setSetting } from "@/lib/settings";
import { normalizePhMobile } from "@/lib/funnel";
import { sendWeeklySummary } from "@/lib/weekly";
import { erasePerson } from "@/lib/privacy";

const time = z.string().regex(/^\d{2}:\d{2}$/);

export async function addScheduleRule(formData: FormData) {
  const user = await requirePermission("booking:write");
  const data = z
    .object({ weekday: z.coerce.number().int().min(0).max(6), startTime: time, endTime: time })
    .refine((d) => d.startTime < d.endTime, "End must be after start")
    .parse(Object.fromEntries(formData));
  await db.scheduleRule.create({ data });
  await audit({ userId: user.id, action: "CREATE", entity: "ScheduleRule" });
  revalidatePath("/settings/schedule");
}

export async function deleteScheduleRule(id: string) {
  const user = await requirePermission("booking:write");
  await db.scheduleRule.delete({ where: { id } });
  await audit({ userId: user.id, action: "DELETE", entity: "ScheduleRule", entityId: id });
  revalidatePath("/settings/schedule");
}

export async function addBlockedDate(formData: FormData) {
  const user = await requirePermission("booking:write");
  const data = z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().max(100).optional() })
    .parse({ date: formData.get("date"), reason: formData.get("reason") || undefined });
  await db.blockedDate.create({ data });
  await audit({ userId: user.id, action: "CREATE", entity: "BlockedDate" });
  revalidatePath("/settings/schedule");
}

export async function deleteBlockedDate(id: string) {
  const user = await requirePermission("booking:write");
  await db.blockedDate.delete({ where: { id } });
  revalidatePath("/settings/schedule");
  await audit({ userId: user.id, action: "DELETE", entity: "BlockedDate", entityId: id });
}

const typeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
  durationMin: z.coerce.number().int().min(10).max(240),
  feePhp: z.coerce.number().int().min(0),
});

export async function saveConsultationType(id: string | null, formData: FormData) {
  const user = await requirePermission("settings:manage");
  const data = typeSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    durationMin: formData.get("durationMin"),
    feePhp: formData.get("feePhp"),
  });
  const active = formData.get("active") !== null ? formData.get("active") === "on" : true;
  if (id) await db.consultationType.update({ where: { id }, data: { ...data, active } });
  else await db.consultationType.create({ data: { ...data, sortOrder: await db.consultationType.count() } });
  await audit({ userId: user.id, action: id ? "UPDATE" : "CREATE", entity: "ConsultationType", entityId: id });
  revalidatePath("/settings/schedule");
}

export async function saveFollowUpDays(formData: FormData) {
  await requirePermission("settings:manage");
  const days = z.coerce.number().int().min(1).max(60).parse(formData.get("followUpDays"));
  await setSetting("followUpDays", String(days));
  revalidatePath("/settings/schedule");
}

export async function createUser(formData: FormData) {
  const owner = await requirePermission("users:manage");
  const data = z
    .object({
      name: z.string().trim().min(1).max(80),
      email: z.string().email().transform((v) => v.toLowerCase().trim()),
      role: z.string().refine(isRole),
    })
    .parse(Object.fromEntries(formData));
  // One-time temporary password shown to the owner once.
  const tempPassword = randomBytes(9).toString("base64url");
  const user = await db.user.create({
    data: { ...data, passwordHash: await bcrypt.hash(tempPassword, 12) },
  });
  await audit({ userId: owner.id, action: "CREATE", entity: "User", entityId: user.id, detail: `role=${data.role}` });
  // Shown once via a short-lived cookie so the password never appears in URLs or logs.
  (await cookies()).set("flash_temp", JSON.stringify({ email: data.email, temp: tempPassword }), {
    httpOnly: true, secure: true, sameSite: "strict", maxAge: 60, path: "/settings/users",
  });
  redirect("/settings/users");
}

export async function toggleUserActive(id: string) {
  const owner = await requirePermission("users:manage");
  if (id === owner.id) return;
  const user = await db.user.findUniqueOrThrow({ where: { id } });
  await db.user.update({ where: { id }, data: { active: !user.active } });
  await audit({ userId: owner.id, action: "UPDATE", entity: "User", entityId: id, detail: user.active ? "deactivated" : "activated" });
  revalidatePath("/settings/users");
}

export async function changePassword(formData: FormData) {
  const user = await requirePermission("leads:read");
  const { current, next } = z
    .object({ current: z.string().min(1), next: z.string().min(12, "At least 12 characters") })
    .parse(Object.fromEntries(formData));
  if (!(await bcrypt.compare(current, user.passwordHash))) redirect("/settings/users?pw=wrong");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  await audit({ userId: user.id, action: "UPDATE", entity: "User", entityId: user.id, detail: "password changed" });
  redirect("/settings/users?pw=ok");
}

export async function syncGoogleNow() {
  await requirePermission("settings:manage");
  const result = await pullFromGoogle().catch(() => null);
  redirect(result ? `/settings/google?synced=${result.busy}` : "/settings/google?error=failed");
}

export async function createCampaign(formData: FormData) {
  const user = await requirePermission("settings:manage");
  const data = z
    .object({
      name: z.string().trim().min(1).max(100),
      channel: z.string().min(1),
      trackingCode: z.string().trim().regex(/^[a-z0-9_-]{2,40}$/i, "Letters, numbers, - and _ only"),
      notes: z.string().max(500).optional(),
    })
    .parse({ ...Object.fromEntries(formData), notes: formData.get("notes") || undefined });
  await db.campaign.create({ data: { ...data, trackingCode: data.trackingCode.toLowerCase(), startDate: new Date() } });
  await audit({ userId: user.id, action: "CREATE", entity: "Campaign" });
  revalidatePath("/settings/campaigns");
}

export async function saveMessengerSettings(formData: FormData) {
  const user = await requirePermission("settings:manage");
  const flag = (k: string) => (formData.get(k) === "on" ? "1" : "0");
  await setSetting("automationEnabled", flag("automationEnabled"));
  await setSetting("remindersEnabled", flag("remindersEnabled"));
  await setSetting("smsEnabled", flag("smsEnabled"));
  const hours = z.coerce.number().int().min(1).max(48).parse(formData.get("autoNoShowHours"));
  await setSetting("autoNoShowHours", String(hours));
  await audit({ userId: user.id, action: "UPDATE", entity: "Setting", detail: "messenger settings" });
  redirect("/settings/messenger?saved=1");
}

export async function setupReminderTemplate() {
  const user = await requirePermission("settings:manage");
  const name = "cm101_appointment_reminder";
  const language = "en_US";
  const result = await createReminderTemplate(name, language);
  if ("error" in result && result.error) redirect(`/settings/messenger?template_error=${encodeURIComponent(result.error)}`);
  await setSetting("utilityTemplateName", name);
  await setSetting("utilityTemplateLanguage", language);
  await audit({ userId: user.id, action: "CREATE", entity: "MessageTemplate", detail: name });
  redirect("/settings/messenger?template=1");
}

export async function saveFollowUpSettings(formData: FormData) {
  const user = await requirePermission("settings:manage");
  const n = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
  const d = z
    .object({
      recallRepeatDays: n(1, 60), recallMaxCount: n(1, 10), stalledPlanDays: n(3, 120),
      recallInactiveDays: n(14, 730), feedbackEveryDays: n(1, 365), receiptHeader: z.string().max(400),
    })
    .parse(Object.fromEntries(formData));
  await setSetting("recallEnabled", formData.get("recallEnabled") === "on" ? "1" : "0");
  await setSetting("feedbackEnabled", formData.get("feedbackEnabled") === "on" ? "1" : "0");
  for (const key of ["recallRepeatDays", "recallMaxCount", "stalledPlanDays", "recallInactiveDays", "feedbackEveryDays"] as const) {
    await setSetting(key, String(d[key]));
  }
  await setSetting("receiptHeader", d.receiptHeader.trim());
  await audit({ userId: user.id, action: "UPDATE", entity: "Setting", detail: "follow-up & billing" });
  redirect("/settings/followup?saved=1");
}

export async function saveCampaignStat(campaignId: string, weekStart: string, formData: FormData) {
  const user = await requirePermission("settings:manage");
  const d = z
    .object({ views: z.coerce.number().int().min(0).max(1e9), likes: z.coerce.number().int().min(0).max(1e9) })
    .parse({ views: formData.get("views") || 0, likes: formData.get("likes") || 0 });
  await db.campaignStat.upsert({
    where: { campaignId_weekStart: { campaignId, weekStart } },
    create: { campaignId, weekStart, ...d },
    update: d,
  });
  await audit({ userId: user.id, action: "UPDATE", entity: "Campaign", entityId: campaignId, detail: `reach ${weekStart}` });
  redirect(`/settings/campaigns?week=${weekStart}&saved=1`);
}

export async function saveWeeklyEmailSettings(formData: FormData) {
  const user = await requirePermission("settings:manage");
  await setSetting("weeklyEmailEnabled", formData.get("weeklyEmailEnabled") === "on" ? "1" : "0");
  const to = String(formData.get("weeklyEmailTo") ?? "").trim();
  if (to && !z.string().email().safeParse(to).success) redirect("/settings/exports?error=email");
  await setSetting("weeklyEmailTo", to);
  await audit({ userId: user.id, action: "UPDATE", entity: "Setting", detail: "weekly email" });
  redirect("/settings/exports?saved=1");
}

export async function sendWeeklyEmailNow() {
  const user = await requirePermission("settings:manage");
  const r = await sendWeeklySummary();
  await audit({ userId: user.id, action: "SEND", entity: "Report", detail: `weekly summary ${r.ok ? "sent" : "failed"}` });
  redirect(`/settings/exports?sent=${r.ok ? "1" : encodeURIComponent(r.error ?? "failed")}`);
}

export async function erasePersonAction(target: { leadId?: string; patientId?: string; confirmWord: string }, formData: FormData) {
  const user = await requirePermission("data:export");
  const back = target.patientId ? `/patients/${target.patientId}` : `/leads/${target.leadId}`;
  const reason = String(formData.get("reason") ?? "").trim();
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== target.confirmWord.toUpperCase() || !reason) {
    redirect(`${back}?erase=confirm`);
  }
  const { ref } = await erasePerson(target, user.id, reason);
  redirect(`/settings/privacy?erased=${encodeURIComponent(ref)}`);
}

export async function saveRetentionSettings(formData: FormData) {
  const user = await requirePermission("settings:manage");
  const d = z
    .object({ retentionPatientYears: z.coerce.number().int().min(1).max(50), retentionLeadMonths: z.coerce.number().int().min(1).max(120) })
    .parse(Object.fromEntries(formData));
  await setSetting("retentionPatientYears", String(d.retentionPatientYears));
  await setSetting("retentionLeadMonths", String(d.retentionLeadMonths));
  await audit({ userId: user.id, action: "UPDATE", entity: "Setting", detail: "retention" });
  redirect("/settings/privacy?saved=1");
}

export async function saveLandingSettings(formData: FormData) {
  const user = await requirePermission("settings:manage");
  const d = z
    .object({
      landingHeadline: z.string().trim().min(1).max(200),
      landingSubheadline: z.string().trim().max(500),
      landingOffer: z.string().trim().max(200),
      landingPromoName: z.string().trim().max(80),
      landingPromoOldPrice: z.string().trim().regex(/^\d{0,7}$/, "Whole pesos only"),
      landingPromoPrice: z.string().trim().regex(/^\d{0,7}$/, "Whole pesos only"),
      landingPromoDesc: z.string().trim().max(600),
      landingBenefits: z.string().max(1500),
      landingFaq: z.string().max(4000),
      landingCta: z.string().trim().min(1).max(60),
      landingFeeNote: z.string().trim().max(250),
      landingDoctorBioEn: z.string().trim().max(1200),
      landingPromoDescEn: z.string().trim().max(600),
      landingFeeNoteEn: z.string().trim().max(250),
      clinicPhone: z.string().trim().max(30).refine((p) => p === "" || normalizePhMobile(p) !== null, "Mobile number only, e.g. 0922 875 2899"),
      clinicHours: z.string().trim().max(200),
      clinicHoursEn: z.string().trim().max(200),
      landingDoctorName: z.string().trim().min(1).max(80),
      landingDoctorTitle: z.string().trim().max(150),
      landingDoctorBio: z.string().trim().max(1200),
    })
    .parse(Object.fromEntries(formData));
  for (const flag of ["landingEnabled", "landingShowFees", "landingShowTestimonials"] as const) {
    await setSetting(flag, formData.get(flag) === "on" ? "1" : "0");
  }
  for (const [key, value] of Object.entries(d)) await setSetting(key as keyof typeof d, value.trim());
  await audit({ userId: user.id, action: "UPDATE", entity: "Setting", detail: "landing page" });
  revalidatePath("/start");
  redirect("/settings/landing?saved=1");
}

export async function saveWebsiteSettings(formData: FormData) {
  const user = await requirePermission("settings:manage");
  const d = z
    .object({
      siteHeadline: z.string().trim().min(1).max(200),
      siteHeadlineEn: z.string().trim().min(1).max(200),
      siteIntro: z.string().trim().max(600),
      siteIntroEn: z.string().trim().max(600),
      siteServices: z.string().max(5000),
      siteServicesEn: z.string().max(5000),
    })
    .parse(Object.fromEntries(formData));
  await setSetting("siteEnabled", formData.get("siteEnabled") === "on" ? "1" : "0");
  for (const [key, value] of Object.entries(d)) await setSetting(key as keyof typeof d, value.trim());
  await audit({ userId: user.id, action: "UPDATE", entity: "Setting", detail: "website" });
  revalidatePath("/clinic");
  revalidatePath("/clinic/tl");
  redirect("/settings/website?saved=1");
}

export async function saveAiSettings(formData: FormData) {
  const user = await requirePermission("settings:manage");
  await setSetting("aiRepliesEnabled", formData.get("aiRepliesEnabled") === "on" ? "1" : "0");
  await setSetting("aiHealthInquiries", formData.get("aiHealthInquiries") === "on" ? "1" : "0");
  const limit = z.coerce.number().int().min(0).max(5000).parse(formData.get("aiDailyLimit"));
  await setSetting("aiDailyLimit", String(limit));
  await audit({ userId: user.id, action: "UPDATE", entity: "Setting", detail: "AI reply settings" });
  redirect("/settings/messenger?saved=1");
}

export async function saveCommentSettings(formData: FormData) {
  const user = await requirePermission("settings:manage");
  const privateText = z.string().trim().min(5).max(1000).safeParse(formData.get("commentPrivateText"));
  const publicText = z.string().trim().max(500).safeParse(formData.get("commentPublicText") ?? "");
  if (!privateText.success || !publicText.success) redirect("/settings/messenger?comment_error=1");
  await setSetting("commentRepliesEnabled", formData.get("commentRepliesEnabled") === "on" ? "1" : "0");
  await setSetting("commentPrivateText", privateText.data);
  await setSetting("commentPublicText", publicText.data);
  await audit({ userId: user.id, action: "UPDATE", entity: "Setting", detail: "comment-to-Messenger settings" });
  redirect("/settings/messenger?saved=1");
}

const simLine = z.object({
  from: z.enum(["patient", "bot"]),
  text: z.string().max(4000),
  byAi: z.boolean().optional(),
  quickReplies: z.array(z.object({ title: z.string().max(40), payload: z.string().max(200) })).max(13).optional(),
});
const simSession = z.object({
  lines: z.array(simLine).max(80),
  state: z.string().max(2000),
  name: z.string().max(120).optional(),
  mobile: z.string().max(30).optional(),
  email: z.string().max(120).optional(),
  handedOff: z.boolean().optional(),
});

/** One turn of the practice chat (Settings → Messenger → Practice chat). Nothing is sent or saved. */
export async function practiceChatTurn(input: { session: unknown; text?: string; payload?: string; useAi: boolean }) {
  await requirePermission("settings:manage");
  const { simulateTurn } = await import("@/lib/messenger/simulator");
  const session = simSession.safeParse(input.session);
  if (!session.success) return { error: "Nag-reset ang practice chat. Subukan ulit." };
  const text = input.text?.trim().slice(0, 600) || undefined;
  const payload = input.payload?.slice(0, 200) || undefined;
  if (!text && !payload) return { error: "Mag-type ng message." };
  try {
    return await simulateTurn(session.data, { text, payload }, { useAi: input.useAi });
  } catch (err) {
    console.error("Practice chat failed:", (err as Error).message);
    return { error: "May error sa practice chat. Subukan ulit." };
  }
}

export type AiTestResult = { action?: string; reply?: string; note?: string; error?: string };

/** Preview the AI reply to a sample message. Nothing is sent to any patient. */
export async function testAiReply(_prev: AiTestResult, formData: FormData): Promise<AiTestResult> {
  await requirePermission("settings:manage");
  const { decideAiReply, generateAiDecision } = await import("@/lib/messenger/ai");
  const { aiApiKey, loadClinicFacts, loadStyleExamples } = await import("@/lib/messenger/ai-context");
  const { getSetting } = await import("@/lib/settings");
  const text = z.string().trim().min(1).max(600).safeParse(formData.get("text"));
  if (!text.success) return { error: "Mag-type ng sample message." };
  const apiKey = await aiApiKey();
  if (!apiKey) return { error: "Wala pang API key. Ilagay muna ito sa itaas." };
  const [facts, examples, health] = await Promise.all([loadClinicFacts(), loadStyleExamples(), getSetting("aiHealthInquiries")]);
  const decision = await decideAiReply({ text: text.data, facts, examples, allowHealth: health === "1", history: [{ from: "patient", text: text.data }] }, (args) => generateAiDecision({ ...args, apiKey }));
  if (!decision) return { error: "Hindi sumagot ang AI (error o timeout). Sa live, ipapasa ito sa staff." };
  if (!decision.reply) {
    return { action: "handoff", note: "Emergency, health (kapag naka-off ang health inquiries), o hindi ligtas na sagot: ang matatanggap ng pasyente ay ang 'Ipapasa sa doktor' na script, at aabisuhan ang doktor." };
  }
  return { action: decision.action, reply: decision.reply, note: decision.notifyDoctor ? "Health inquiry: aabisuhan din ang doktor." : undefined };
}

export async function collectAiExamples(formData: FormData) {
  const user = await requirePermission("settings:manage");
  const { collectStyleExamples } = await import("@/lib/messenger/ai-context");
  const result = await collectStyleExamples({ facebook: formData.get("facebook") === "on" });
  await audit({ userId: user.id, action: "CREATE", entity: "AiExample", detail: `collected ${result.added}` });
  const q = new URLSearchParams({ added: String(result.added), ...(result.error ? { fb_error: result.error.slice(0, 200) } : {}) });
  redirect(`/settings/messenger/examples?${q}`);
}

export async function setAiExample(formData: FormData) {
  const user = await requirePermission("settings:manage");
  const id = z.string().min(1).parse(formData.get("id"));
  const op = z.enum(["approve", "unapprove", "delete"]).parse(formData.get("op"));
  if (op === "delete") await db.aiExample.delete({ where: { id } });
  else await db.aiExample.update({ where: { id }, data: { approved: op === "approve" } });
  await audit({ userId: user.id, action: op === "delete" ? "DELETE" : "UPDATE", entity: "AiExample", entityId: id });
  revalidatePath("/settings/messenger/examples");
}

/** Save the Anthropic API key from the browser (stored encrypted). Empty "clear" removes it. */
export async function saveAiApiKey(formData: FormData) {
  const user = await requirePermission("settings:manage");
  if (formData.get("clear") === "1") {
    await setSetting("aiApiKeyEnc", "");
    await audit({ userId: user.id, action: "UPDATE", entity: "Setting", detail: "AI API key removed" });
    redirect("/settings/messenger?saved=1");
  }
  const key = String(formData.get("apiKey") ?? "").replace(/\s+/g, "");
  if (!/^sk-ant-[\w-]{20,}$/.test(key)) redirect("/settings/messenger?key_error=1");
  const { encrypt } = await import("@/lib/crypto");
  await setSetting("aiApiKeyEnc", encrypt(key));
  await audit({ userId: user.id, action: "UPDATE", entity: "Setting", detail: "AI API key saved" });
  redirect("/settings/messenger?saved=1");
}

/** Facebook keys from the Settings form (stored encrypted; clinic.env values take priority). */
export async function saveFacebookKeys(formData: FormData) {
  const user = await requirePermission("settings:manage");
  const { META_FIELDS, saveMetaCreds, clearMetaCreds } = await import("@/lib/messenger/meta-creds");
  if (formData.get("clear") === "1") {
    await clearMetaCreds();
    await audit({ userId: user.id, action: "UPDATE", entity: "Setting", detail: "Facebook keys removed" });
    redirect("/settings/messenger?saved=1");
  }
  const input = Object.fromEntries(Object.keys(META_FIELDS).map((k) => [k, String(formData.get(k) ?? "")]));
  if (input.META_APP_ID && !/^\d{5,}$/.test(input.META_APP_ID.trim())) redirect("/settings/messenger?fb_error=appid");
  if (input.META_PAGE_ID && !/^\d{5,}$/.test(input.META_PAGE_ID.trim())) redirect("/settings/messenger?fb_error=pageid");
  // Catch a browser autofilling the saved login (email/password) into these fields.
  if (input.META_APP_SECRET && !/^[a-f0-9]{32}$/i.test(input.META_APP_SECRET.trim())) redirect("/settings/messenger?fb_error=secret");
  if (input.META_PAGE_ACCESS_TOKEN && !/^EAA[\w-]{20,}$/.test(input.META_PAGE_ACCESS_TOKEN.replace(/\s+/g, ""))) redirect("/settings/messenger?fb_error=token");
  if (input.FB_PAGE_USERNAME && !/^[\w.-]{3,50}$/.test(input.FB_PAGE_USERNAME.trim())) redirect("/settings/messenger?fb_error=username");
  await saveMetaCreds(input);
  await audit({ userId: user.id, action: "UPDATE", entity: "Setting", detail: "Facebook keys saved" });
  redirect("/settings/messenger?saved=1");
}
