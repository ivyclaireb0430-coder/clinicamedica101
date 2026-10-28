"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { encryptOptional, encrypt } from "@/lib/crypto";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import {
  INTAKE_TTL_DAYS, checkPlanTransition, convertLeadToPatient, newIntakeToken, onPlanStatusChanged,
} from "@/lib/clinical";
import { saveEncryptedFile, validateUpload, deleteEncryptedFile } from "@/lib/files";
import { renderScript } from "@/lib/scripts";
import { sendText, withinWindow } from "@/lib/messenger/meta";
import { storeOutgoing } from "@/lib/messenger/handler";
import { todayManila } from "@/lib/time";
import { can } from "@/lib/roles";
import { packageActive } from "@/lib/billing";
import { closeFollowUpsForVisit } from "@/lib/visits";

const text = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

// ── Patients ──

export async function convertLead(leadId: string) {
  const user = await requirePermission("leads:write");
  const patient = await convertLeadToPatient(leadId, user.id);
  redirect(`/patients/${patient.id}`);
}

export async function updatePatient(id: string, fd: FormData) {
  const user = await requirePermission("leads:write");
  const data = z
    .object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().max(80).nullable(),
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      sex: z.enum(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"]).nullable(),
      mobile: z.string().max(30).nullable(),
      email: z.string().email().nullable(),
      address: z.string().max(300).nullable(),
      occupation: z.string().max(100).nullable(),
      emergencyContact: z.string().max(200).nullable(),
    })
    .parse(Object.fromEntries(["firstName", "lastName", "birthDate", "sex", "mobile", "email", "address", "occupation", "emergencyContact"].map((k) => [k, text(fd, k)])));
  await db.patient.update({ where: { id }, data: { ...data, firstName: data.firstName } });
  await audit({ userId: user.id, action: "UPDATE", entity: "Patient", entityId: id });
  redirect(`/patients/${id}`);
}

// ── Intake link ──

export async function createIntakeLink(target: { leadId?: string; patientId?: string }, fd: FormData) {
  const user = await requirePermission("leads:write");
  let leadId = target.leadId ?? null;
  if (!leadId && target.patientId) leadId = (await db.patient.findUnique({ where: { id: target.patientId } }))?.leadId ?? null;
  const form = await db.intakeForm.create({
    data: {
      token: newIntakeToken(),
      expiresAt: new Date(Date.now() + INTAKE_TTL_DAYS * 86_400_000),
      leadId,
      patientId: target.patientId ?? (leadId ? (await db.patient.findUnique({ where: { leadId } }))?.id : null) ?? null,
    },
  });
  await audit({ userId: user.id, action: "CREATE", entity: "IntakeForm", entityId: form.id });
  const url = `${process.env.APP_URL ?? ""}/intake/${form.token}`;
  const back = target.patientId ? `/patients/${target.patientId}` : `/leads/${leadId}`;

  if (fd.get("viaMessenger") === "on" && leadId) {
    const convo = await db.conversation.findUnique({ where: { leadId }, include: { lead: true } });
    if (!convo || !withinWindow(convo.lastUserMessageAt)) redirect(`${back}?intake=nowindow`);
    const script = await db.script.findUnique({ where: { key: "intake_link" } });
    const msg = renderScript(script?.body ?? "Hi {first_name}! Paki-sagot po ang pre-consult form bago ang consultation: [link]", {
      first_name: convo.lead.firstName,
    }).replace("[link]", url);
    const r = await sendText(convo.psid, { text: msg });
    await storeOutgoing(convo.id, msg, "DOCTOR", r);
    redirect(`${back}?intake=${r.error ? "failed" : "sent"}`);
  }
  redirect(`${back}?intake=created`);
}

// ── Assessments ──

async function saveUploads(fd: FormData, patientId: string, userId: string, kind: string, assessmentId?: string) {
  const files = fd.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0);
  const ids: string[] = [];
  for (const file of files) {
    const err = validateUpload(file);
    if (err) throw new Error(`${file.name}: ${err}`);
    const key = await saveEncryptedFile(Buffer.from(await file.arrayBuffer()));
    const a = await db.attachment.create({
      data: { patientId, assessmentId, kind, filenameEnc: encrypt(file.name), mimeType: file.type, size: file.size, storageKey: key, uploadedById: userId },
    });
    ids.push(a.id);
  }
  return ids;
}

const ASSESSMENT_FIELDS = ["chiefComplaint", "symptoms", "exam", "investigations", "results", "explained"] as const;

export async function saveAssessment(patientId: string, assessmentId: string | null, fd: FormData) {
  const user = await requirePermission("clinical:write");
  const enc = Object.fromEntries(ASSESSMENT_FIELDS.map((f) => [`${f}Enc`, encryptOptional(text(fd, f))]));
  const appointmentId = text(fd, "appointmentId");
  const date = text(fd, "date");
  const data = { ...enc, appointmentId, ...(date ? { date: new Date(`${date}T12:00:00+08:00`) } : {}) };
  const a = assessmentId
    ? await db.assessment.update({ where: { id: assessmentId }, data })
    : await db.assessment.create({ data: { ...data, patientId, authorId: user.id } });
  try {
    await saveUploads(fd, patientId, user.id, "RESULT", a.id);
  } catch (err) {
    redirect(`/patients/${patientId}/assessments/${a.id}?error=${encodeURIComponent((err as Error).message)}`);
  }
  await audit({ userId: user.id, action: assessmentId ? "UPDATE" : "CREATE", entity: "Assessment", entityId: a.id });
  redirect(`/patients/${patientId}/assessments/${a.id}?saved=1`);
}

export async function deleteAttachment(id: string, back: string) {
  const user = await requirePermission("clinical:write");
  const a = await db.attachment.findUniqueOrThrow({ where: { id }, include: { consents: true } });
  if (a.consents.length) redirect(`${back}?error=${encodeURIComponent("This file is a signed consent form and can't be deleted")}`);
  await db.attachment.delete({ where: { id } });
  await deleteEncryptedFile(a.storageKey);
  await audit({ userId: user.id, action: "DELETE", entity: "Attachment", entityId: id });
  redirect(back);
}

// ── Treatment plans ──

export async function savePlan(patientId: string, planId: string | null, fd: FormData) {
  const user = await requirePermission("clinical:write");
  if (planId) {
    const existing = await db.treatmentPlan.findUniqueOrThrow({ where: { id: planId } });
    if (!["DRAFT", "PROPOSED", "DECLINED"].includes(existing.status)) {
      redirect(`/patients/${patientId}/plans/${planId}?error=${encodeURIComponent("Accepted or started plans can't be edited. Create a new plan instead.")}`);
    }
  }
  const modalities = fd.getAll("modality").map(String);
  const sessions = fd.getAll("sessions").map(Number);
  const prices = fd.getAll("unitPricePhp").map(Number);
  const notes = fd.getAll("itemNotes").map(String);
  const items = modalities
    .map((m, i) => ({ modality: m.trim(), sessions: sessions[i] || 0, unitPricePhp: prices[i] || 0, notes: notes[i]?.trim() || null, sortOrder: i }))
    .filter((i) => i.modality && i.sessions > 0 && i.unitPricePhp >= 0);

  const data = {
    title: text(fd, "title") ?? `Treatment plan – ${todayManila()}`,
    goalsEnc: encryptOptional(text(fd, "goals")),
    scheduleEnc: encryptOptional(text(fd, "schedule")),
    benefitsEnc: encryptOptional(text(fd, "benefits")),
    risksEnc: encryptOptional(text(fd, "risks")),
    alternativesEnc: encryptOptional(text(fd, "alternatives")),
  };
  const plan = planId
    ? await db.treatmentPlan.update({ where: { id: planId }, data: { ...data, items: { deleteMany: {}, create: items } } })
    : await db.treatmentPlan.create({ data: { ...data, patientId, authorId: user.id, items: { create: items } } });
  await audit({ userId: user.id, action: planId ? "UPDATE" : "CREATE", entity: "TreatmentPlan", entityId: plan.id });
  redirect(`/patients/${patientId}/plans/${plan.id}?saved=1`);
}

export async function setPlanStatus(planId: string, fd: FormData) {
  const user = await requirePermission("clinical:write");
  const to = String(fd.get("status"));
  const plan = await db.treatmentPlan.findUniqueOrThrow({ where: { id: planId }, include: { consent: true, _count: { select: { items: true } } } });
  const check = checkPlanTransition(plan.status, to, { hasConsent: Boolean(plan.consent), itemCount: plan._count.items });
  if (!check.ok) redirect(`/patients/${plan.patientId}/plans/${planId}?error=${encodeURIComponent(check.error)}`);
  await db.treatmentPlan.update({
    where: { id: planId },
    data: { status: to, declineReason: to === "DECLINED" ? text(fd, "declineReason") : null, ...(to === "STARTED" ? { startedAt: new Date() } : {}) },
  });
  await onPlanStatusChanged(planId, to, user.id);
  await audit({ userId: user.id, action: "UPDATE", entity: "TreatmentPlan", entityId: planId, detail: `status=${to}` });
  revalidatePath(`/patients/${plan.patientId}/plans/${planId}`);
}

export async function recordConsent(planId: string, fd: FormData) {
  const user = await requirePermission("clinical:write");
  const plan = await db.treatmentPlan.findUniqueOrThrow({ where: { id: planId } });
  const back = `/patients/${plan.patientId}/plans/${planId}`;
  const parsed = z
    .object({
      consentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      acknowledgement: z.string().trim().min(10, "Describe what was explained and acknowledged").max(2000),
      patientAcknowledged: z.literal("on", { errorMap: () => ({ message: "The patient must acknowledge the plan" }) }),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`${back}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  let signedFormId: string | null = null;
  try {
    [signedFormId = null] = await saveUploads(fd, plan.patientId, user.id, "CONSENT_FORM");
  } catch (err) {
    redirect(`${back}?error=${encodeURIComponent((err as Error).message)}`);
  }
  await db.treatmentConsent.upsert({
    where: { planId },
    create: {
      planId, consentDate: parsed.data.consentDate, acknowledgement: parsed.data.acknowledgement, patientAcknowledged: true,
      explainedById: user.id, explainedByName: user.name, signedFormId,
    },
    update: {
      consentDate: parsed.data.consentDate, acknowledgement: parsed.data.acknowledgement, patientAcknowledged: true,
      explainedById: user.id, explainedByName: user.name, ...(signedFormId ? { signedFormId } : {}),
    },
  });
  await audit({ userId: user.id, action: "CREATE", entity: "TreatmentConsent", entityId: planId });
  redirect(`${back}?consent=1`);
}

export async function addSession(planId: string, fd: FormData) {
  const user = await requirePermission("clinical:write");
  const plan = await db.treatmentPlan.findUniqueOrThrow({ where: { id: planId }, include: { items: true } });
  const back = `/patients/${plan.patientId}/plans/${planId}`;
  if (plan.status !== "STARTED") redirect(`${back}?error=${encodeURIComponent("Start the plan before logging sessions")}`);
  const date = text(fd, "date") ?? todayManila();
  const modality = text(fd, "modality");
  if (!modality) redirect(`${back}?error=${encodeURIComponent("Choose the modality for this session")}`);
  const scoreRaw = text(fd, "score");
  const score = scoreRaw === null ? null : Number(scoreRaw);
  if (score !== null && !(Number.isInteger(score) && score >= 0 && score <= 10)) redirect(`${back}?error=${encodeURIComponent("Progress score must be 0 to 10")}`);
  const nextDate = text(fd, "nextDate");
  if (nextDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) redirect(`${back}?error=${encodeURIComponent("Invalid next follow-up date")}`);

  // Billing for this session: a charge, one prepaid package session, or nothing.
  const billing = text(fd, "billing") ?? "none";
  // Blank amount = the plan's unit price for this modality.
  const amount = Number(text(fd, "chargeAmount") ?? plan.items.find((i) => i.modality === modality)?.unitPricePhp ?? 0);
  let packageId: string | null = null;
  if (billing.startsWith("package:")) {
    if (!can(user.role, "billing:write")) redirect(`${back}?error=${encodeURIComponent("No billing access")}`);
    packageId = billing.slice("package:".length);
    const pkg = await db.patientPackage.findUnique({ where: { id: packageId }, include: { uses: true } });
    if (!pkg || pkg.patientId !== plan.patientId || !packageActive(pkg)) redirect(`${back}?error=${encodeURIComponent("That package has no sessions left")}`);
  } else if (billing === "charge") {
    if (!can(user.role, "billing:write")) redirect(`${back}?error=${encodeURIComponent("No billing access")}`);
    if (!(Number.isInteger(amount) && amount > 0)) redirect(`${back}?error=${encodeURIComponent("Enter the session charge in whole pesos")}`);
  }

  const s = await db.treatmentSession.create({
    data: {
      planId, patientId: plan.patientId, date, modality, appointmentId: text(fd, "appointmentId"),
      progressNotesEnc: encryptOptional(text(fd, "progressNotes")), authorId: user.id,
    },
  });
  await audit({ userId: user.id, action: "CREATE", entity: "TreatmentSession", entityId: s.id });
  if (score !== null) {
    await db.progressEntry.create({ data: { patientId: plan.patientId, sessionId: s.id, date, score, authorId: user.id } });
  }
  if (packageId) {
    await db.packageUse.create({ data: { packageId, sessionId: s.id, date } });
  } else if (billing === "charge") {
    await db.charge.create({
      data: { patientId: plan.patientId, date, category: "SESSION", description: `Treatment session – ${modality}`, amountPhp: amount, sessionId: s.id, createdById: user.id },
    });
  }
  await closeFollowUpsForVisit(plan.patientId, date);
  if (nextDate) {
    await db.followUp.create({ data: { patientId: plan.patientId, dueDate: nextDate, kind: "NEXT_SESSION", createdById: user.id } });
  }
  redirect(`${back}?session=1`);
}

// ── Progress tracking ──

export async function addProgress(patientId: string, fd: FormData) {
  const user = await requirePermission("clinical:write");
  const parsed = z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), score: z.coerce.number().int().min(0).max(10), notes: z.string().max(2000).nullable() })
    .safeParse({ date: text(fd, "date") ?? todayManila(), score: text(fd, "score"), notes: text(fd, "notes") });
  if (!parsed.success) redirect(`/patients/${patientId}?tab=progress&error=${encodeURIComponent("Score must be 0 to 10")}`);
  const e = await db.progressEntry.create({
    data: { patientId, date: parsed.data!.date, score: parsed.data!.score, notesEnc: encryptOptional(parsed.data!.notes), authorId: user.id },
  });
  await audit({ userId: user.id, action: "CREATE", entity: "ProgressEntry", entityId: e.id });
  redirect(`/patients/${patientId}?tab=progress&saved=1`);
}
