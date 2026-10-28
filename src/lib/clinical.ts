import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { audit } from "./audit";
import { advanceLeadStage } from "./booking";

// ── Treatment plan rules (pure; unit-tested) ──

export const PLAN_STATUSES = [
  { key: "DRAFT", label: "Draft" },
  { key: "PROPOSED", label: "Proposed to patient" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "STARTED", label: "Started" },
  { key: "COMPLETED", label: "Completed" },
  { key: "DECLINED", label: "Declined" },
  { key: "CANCELLED", label: "Cancelled" },
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number]["key"];

export function planStatusLabel(key: string) {
  return PLAN_STATUSES.find((s) => s.key === key)?.label ?? key;
}

const ALLOWED: Record<PlanStatus, PlanStatus[]> = {
  DRAFT: ["PROPOSED", "CANCELLED"],
  PROPOSED: ["ACCEPTED", "DECLINED", "DRAFT", "CANCELLED"],
  ACCEPTED: ["STARTED", "CANCELLED", "PROPOSED"],
  STARTED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  DECLINED: ["PROPOSED"],
  CANCELLED: [],
};

export function checkPlanTransition(
  from: string,
  to: string,
  opts: { hasConsent: boolean; itemCount: number },
): { ok: true } | { ok: false; error: string } {
  if (!(from in ALLOWED) || !ALLOWED[from as PlanStatus].includes(to as PlanStatus)) {
    return { ok: false, error: `Can't change a ${planStatusLabel(from)} plan to ${planStatusLabel(to)}` };
  }
  if (to === "PROPOSED" && opts.itemCount === 0) return { ok: false, error: "Add at least one modality before proposing the plan" };
  if (to === "STARTED" && !opts.hasConsent) {
    return { ok: false, error: "Record the patient's informed consent before starting the plan" };
  }
  return { ok: true };
}

export function planTotal(items: { sessions: number; unitPricePhp: number }[]): number {
  return items.reduce((sum, i) => sum + i.sessions * i.unitPricePhp, 0);
}

export function totalSessions(items: { sessions: number }[]): number {
  return items.reduce((sum, i) => sum + i.sessions, 0);
}

// ── Patients ──

export function formatPatientNo(n: number): string {
  return `CM-${String(n).padStart(4, "0")}`;
}

async function nextPatientNo(): Promise<string> {
  const last = await db.patient.findFirst({ orderBy: { patientNo: "desc" }, select: { patientNo: true } });
  const n = last ? Number(last.patientNo.replace(/\D/g, "")) + 1 : 1;
  return formatPatientNo(n);
}

/** Create the patient record from a lead without re-typing. Returns the existing one if already converted. */
export async function convertLeadToPatient(leadId: string, userId: string | null) {
  const existing = await db.patient.findUnique({ where: { leadId } });
  if (existing) return existing;
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const patient = await db.patient.create({
        data: {
          patientNo: await nextPatientNo(),
          leadId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          mobile: lead.mobile,
          email: lead.email,
          privacyConsent: lead.privacyConsent,
          consentAt: lead.consentAt,
        },
      });
      await db.intakeForm.updateMany({ where: { leadId, patientId: null }, data: { patientId: patient.id } });
      await audit({ userId, action: "CREATE", entity: "Patient", entityId: patient.id, detail: "converted from lead" });
      return patient;
    } catch (err) {
      if (attempt === 2 || !String(err).includes("Unique constraint")) throw err;
    }
  }
  throw new Error("unreachable");
}

export async function onPlanStatusChanged(planId: string, status: string, userId: string | null) {
  const plan = await db.treatmentPlan.findUniqueOrThrow({ where: { id: planId }, include: { patient: true } });
  if (["ACCEPTED", "STARTED"].includes(status) && plan.patient.leadId) {
    await advanceLeadStage(plan.patient.leadId, "PLAN_ACCEPTED", userId);
  }
}

// ── Pre-consult intake form ──

export const INTAKE_CONSENT_VERSION = "2026-10";
export const INTAKE_TTL_DAYS = 7;

export function newIntakeToken(): string {
  return randomBytes(24).toString("base64url");
}

const optional = z.string().trim().max(4000).optional().transform((v) => v || undefined);

export const intakeSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(80),
  lastName: z.string().trim().min(1, "Required").max(80),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker"),
  sex: z.enum(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"]),
  mobile: z.string().trim().min(7).max(30),
  email: z.string().trim().email().optional().or(z.literal("")).transform((v) => v || undefined),
  address: optional,
  occupation: optional,
  emergencyContact: optional,
  chiefComplaint: z.string().trim().min(1, "Please describe your main concern").max(4000),
  history: optional, // past illnesses, surgeries, hospitalizations
  familyHistory: optional,
  medications: optional,
  allergies: optional,
  lifestyle: optional, // diet, sleep, exercise, smoking, alcohol, stress
  priorTreatments: optional,
  goals: optional, // what the patient hopes to understand or achieve
  consent: z.literal("on", { errorMap: () => ({ message: "Consent is required to submit the form" }) }),
});

export type IntakeAnswers = Omit<z.infer<typeof intakeSchema>, "consent">;

/** Clinical answers only (demographics go on the Patient record). */
export const CLINICAL_FIELDS = [
  ["chiefComplaint", "Main concern"],
  ["history", "Medical history"],
  ["familyHistory", "Family history"],
  ["medications", "Current medications & supplements"],
  ["allergies", "Allergies"],
  ["lifestyle", "Lifestyle (diet, sleep, exercise, smoking, alcohol, stress)"],
  ["priorTreatments", "Previous treatments tried"],
  ["goals", "What the patient hopes to get from the consult"],
] as const;
