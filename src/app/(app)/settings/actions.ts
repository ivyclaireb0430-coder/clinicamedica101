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
import { sendWeeklySummary } from "@/lib/weekly";

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
