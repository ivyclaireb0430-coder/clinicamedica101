"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { encryptOptional } from "@/lib/crypto";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { audit } from "@/lib/audit";
import { validateStageChange } from "@/lib/pipeline";

const leadSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80).optional(),
  mobile: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  source: z.string().min(1),
  campaignId: z.string().optional(),
  concern: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(2000).optional(),
  privacyConsent: z.boolean(),
});

function parseLead(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v : undefined;
  };
  return leadSchema.parse({
    firstName: get("firstName") ?? "",
    lastName: get("lastName"),
    mobile: get("mobile"),
    email: get("email"),
    source: get("source") ?? "OTHER",
    campaignId: get("campaignId"),
    concern: get("concern"),
    notes: get("notes"),
    privacyConsent: formData.get("privacyConsent") === "on",
  });
}

export async function createLead(formData: FormData) {
  const user = await requirePermission("leads:write");
  const data = parseLead(formData);
  const lead = await db.lead.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      mobile: data.mobile,
      email: data.email || null,
      source: data.source,
      campaignId: data.campaignId || null,
      // Front desk cannot record health information.
      concernEnc: can(user.role, "lead_concern:read") ? encryptOptional(data.concern) : null,
      notes: data.notes,
      privacyConsent: data.privacyConsent,
      consentAt: data.privacyConsent ? new Date() : null,
      stageChanges: { create: { toStage: "NEW", userId: user.id } },
    },
  });
  await audit({ userId: user.id, action: "CREATE", entity: "Lead", entityId: lead.id });
  redirect(`/leads/${lead.id}`);
}

export async function updateLead(id: string, formData: FormData) {
  const user = await requirePermission("leads:write");
  const data = parseLead(formData);
  const existing = await db.lead.findUniqueOrThrow({ where: { id } });
  await db.lead.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName ?? null,
      mobile: data.mobile ?? null,
      email: data.email || null,
      source: data.source,
      campaignId: data.campaignId || null,
      ...(can(user.role, "lead_concern:read") ? { concernEnc: encryptOptional(data.concern) } : {}),
      notes: data.notes ?? null,
      privacyConsent: data.privacyConsent,
      consentAt: data.privacyConsent ? (existing.consentAt ?? new Date()) : null,
    },
  });
  await audit({ userId: user.id, action: "UPDATE", entity: "Lead", entityId: id });
  redirect(`/leads/${id}`);
}

export async function changeStage(id: string, formData: FormData) {
  const user = await requirePermission("leads:write");
  const to = String(formData.get("stage") ?? "");
  const reason = String(formData.get("lostReason") ?? "");
  const result = validateStageChange(to, reason);
  if (!result.ok) redirect(`/leads/${id}?error=${encodeURIComponent(result.error)}`);
  const lead = await db.lead.findUniqueOrThrow({ where: { id } });
  if (lead.stage === result.stage) redirect(`/leads/${id}`);
  await db.$transaction([
    db.lead.update({
      where: { id },
      data: { stage: result.stage, lostReason: result.stage === "LOST" ? reason : null, lastContactAt: new Date() },
    }),
    db.leadStageChange.create({ data: { leadId: id, fromStage: lead.stage, toStage: result.stage, userId: user.id } }),
  ]);
  await audit({ userId: user.id, action: "UPDATE", entity: "Lead", entityId: id, detail: `stage=${result.stage}` });
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

export async function markContacted(id: string) {
  const user = await requirePermission("leads:write");
  await db.lead.update({ where: { id }, data: { lastContactAt: new Date() } });
  await audit({ userId: user.id, action: "UPDATE", entity: "Lead", entityId: id, detail: "contacted" });
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads/follow-up");
}
