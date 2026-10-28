"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { CLINICAL_FIELDS, INTAKE_CONSENT_VERSION, convertLeadToPatient, intakeSchema } from "@/lib/clinical";

export async function submitIntake(token: string, formData: FormData) {
  const form = await db.intakeForm.findUnique({ where: { token } });
  if (!form || form.status !== "SENT" || form.expiresAt < new Date()) redirect(`/intake/${token}`);

  const parsed = intakeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    redirect(`/intake/${token}?error=${encodeURIComponent(`${String(first.path[0] ?? "")}: ${first.message}`)}`);
  }
  const { consent: _consent, ...answers } = parsed.data;

  let patientId = form.patientId;
  if (!patientId && form.leadId) patientId = (await convertLeadToPatient(form.leadId, null)).id;
  if (!patientId) redirect(`/intake/${token}`);

  const demographics = {
    firstName: answers.firstName,
    lastName: answers.lastName,
    birthDate: answers.birthDate,
    sex: answers.sex,
    mobile: answers.mobile,
    email: answers.email ?? null,
    address: answers.address ?? null,
    occupation: answers.occupation ?? null,
    emergencyContact: answers.emergencyContact ?? null,
  };
  const clinical = Object.fromEntries(CLINICAL_FIELDS.map(([k]) => [k, answers[k]]));
  const now = new Date();

  await db.$transaction([
    db.intakeForm.update({
      where: { id: form.id },
      data: {
        patientId,
        status: "SUBMITTED",
        answersEnc: encryptJson(clinical),
        consentGiven: true,
        consentVersion: INTAKE_CONSENT_VERSION,
        submittedAt: now,
      },
    }),
    db.patient.update({ where: { id: patientId }, data: { ...demographics, privacyConsent: true, consentAt: now } }),
    ...(form.leadId
      ? [db.lead.update({ where: { id: form.leadId }, data: { privacyConsent: true, consentAt: now, mobile: answers.mobile, email: answers.email ?? undefined } })]
      : []),
  ]);
  await audit({ action: "CREATE", entity: "IntakeForm", entityId: form.id, detail: "submitted by patient" });
  redirect(`/intake/${token}?done=1`);
}
