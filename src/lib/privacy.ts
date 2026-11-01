import { db } from "./db";
import { decryptJson, decryptOptional } from "./crypto";
import { deleteEncryptedFile } from "./files";
import { categoryLabel } from "./billing";
import { audit } from "./audit";
import { pushAppointment } from "./google";

// Data Privacy Act (RA 10173) rights: access (export everything we hold about a person) and erasure.

/** Everything held about one person, decrypted, for a data-access request. */
export async function exportPerson(target: { leadId?: string; patientId?: string }) {
  const patient = target.patientId
    ? await db.patient.findUnique({ where: { id: target.patientId } })
    : target.leadId ? await db.patient.findUnique({ where: { leadId: target.leadId } }) : null;
  const leadId = target.leadId ?? patient?.leadId ?? null;
  const lead = leadId
    ? await db.lead.findUnique({
        where: { id: leadId },
        include: {
          campaign: { select: { name: true } },
          appointments: { include: { consultationType: { select: { name: true } } }, orderBy: { startAt: "asc" } },
          conversation: { include: { messages: { orderBy: { createdAt: "asc" } } } },
          intakeForms: true,
        },
      })
    : null;
  const pid = patient?.id;
  const [assessments, plans, progress, followUps, feedback, charges, payments, packages, attachments, intake] = pid
    ? await Promise.all([
        db.assessment.findMany({ where: { patientId: pid }, orderBy: { date: "asc" } }),
        db.treatmentPlan.findMany({ where: { patientId: pid }, include: { items: true, consent: true, sessions: true } }),
        db.progressEntry.findMany({ where: { patientId: pid }, orderBy: { date: "asc" } }),
        db.followUp.findMany({ where: { patientId: pid } }),
        db.feedback.findMany({ where: { patientId: pid } }),
        db.charge.findMany({ where: { patientId: pid } }),
        db.payment.findMany({ where: { patientId: pid } }),
        db.patientPackage.findMany({ where: { patientId: pid }, include: { uses: true } }),
        db.attachment.findMany({ where: { patientId: pid } }),
        db.intakeForm.findMany({ where: { patientId: pid } }),
      ])
    : [[], [], [], [], [], [], [], [], [], []];

  const intakeForms = [...new Map([...(lead?.intakeForms ?? []), ...intake].map((f) => [f.id, f])).values()];
  return {
    exportedAt: new Date().toISOString(),
    clinic: "Clinica Medica 101",
    inquiry: lead && {
      firstName: lead.firstName, lastName: lead.lastName, mobile: lead.mobile, email: lead.email, source: lead.source,
      campaign: lead.campaign?.name ?? null, healthConcern: decryptOptional(lead.concernEnc), stage: lead.stage,
      privacyConsent: lead.privacyConsent, consentAt: lead.consentAt, firstContactAt: lead.firstContactAt, notes: lead.notes,
    },
    appointments: (lead?.appointments ?? []).map((a) => ({ startAt: a.startAt, type: a.consultationType.name, status: a.status, bookedVia: a.channel })),
    messengerMessages: (lead?.conversation?.messages ?? []).map((m) => ({ at: m.createdAt, from: m.direction === "IN" ? "you" : "clinic", text: decryptOptional(m.textEnc) })),
    patient: patient && {
      patientNo: patient.patientNo, firstName: patient.firstName, lastName: patient.lastName, birthDate: patient.birthDate, sex: patient.sex,
      mobile: patient.mobile, email: patient.email, address: patient.address, occupation: patient.occupation,
      emergencyContact: patient.emergencyContact, privacyConsent: patient.privacyConsent, consentAt: patient.consentAt,
    },
    intakeForms: intakeForms.map((f) => ({ submittedAt: f.submittedAt, consentVersion: f.consentVersion, answers: decryptJson(f.answersEnc) })),
    assessments: assessments.map((a) => ({
      date: a.date, chiefComplaint: decryptOptional(a.chiefComplaintEnc), symptoms: decryptOptional(a.symptomsEnc), examFindings: decryptOptional(a.examEnc),
      investigations: decryptOptional(a.investigationsEnc), results: decryptOptional(a.resultsEnc), explainedToPatient: decryptOptional(a.explainedEnc),
    })),
    treatmentPlans: plans.map((p) => ({
      title: p.title, status: p.status, goals: decryptOptional(p.goalsEnc), schedule: decryptOptional(p.scheduleEnc),
      benefits: decryptOptional(p.benefitsEnc), risks: decryptOptional(p.risksEnc), alternatives: decryptOptional(p.alternativesEnc),
      items: p.items.map((i) => ({ modality: i.modality, sessions: i.sessions, pricePerSessionPhp: i.unitPricePhp })),
      consent: p.consent && { date: p.consent.consentDate, explainedBy: p.consent.explainedByName, acknowledgement: p.consent.acknowledgement },
      sessions: p.sessions.map((s) => ({ date: s.date, modality: s.modality, progressNotes: decryptOptional(s.progressNotesEnc) })),
    })),
    progressRatings: progress.map((e) => ({ date: e.date, score: e.score, notes: decryptOptional(e.notesEnc) })),
    followUps: followUps.map((f) => ({ dueDate: f.dueDate, kind: f.kind, status: f.status })),
    feedback: feedback.filter((f) => f.submittedAt).map((f) => ({ submittedAt: f.submittedAt, rating: f.rating, comment: decryptOptional(f.commentEnc), testimonialConsent: f.testimonialConsent, displayName: f.displayName })),
    charges: charges.map((c) => ({ date: c.date, description: c.description, amountPhp: c.amountPhp, voided: Boolean(c.voidedAt) })),
    payments: payments.map((p) => ({ date: p.date, receiptNo: p.receiptNo, orNumber: p.orNumber, method: p.method, amountPhp: p.amountPhp, voided: Boolean(p.voidedAt) })),
    packages: packages.map((p) => ({ name: p.name, sessionsTotal: p.sessionsTotal, sessionsUsed: p.uses.length, pricePhp: p.pricePhp })),
    files: attachments.map((a) => ({ name: decryptOptional(a.filenameEnc), type: a.mimeType, uploadedAt: a.createdAt, note: "Ask the clinic for a copy of this file." })),
  };
}

/**
 * Erase a person: health information, messages, files, and contact details are deleted.
 * Financial records (receipts) are kept for tax law, under an anonymous name, with service names generalised.
 * Appointment rows stay (anonymous) so past clinic statistics don't change; future ones are cancelled.
 */
export async function erasePerson(target: { leadId?: string; patientId?: string }, userId: string, reason: string) {
  const patient = target.patientId
    ? await db.patient.findUnique({ where: { id: target.patientId } })
    : target.leadId ? await db.patient.findUnique({ where: { leadId: target.leadId } }) : null;
  const leadId = target.leadId ?? patient?.leadId ?? null;
  const ref = patient?.patientNo ?? leadId?.slice(-6) ?? "unknown";

  if (patient) {
    const pid = patient.id;
    const files = await db.attachment.findMany({ where: { patientId: pid }, select: { storageKey: true } });
    await db.treatmentConsent.updateMany({ where: { plan: { patientId: pid } }, data: { signedFormId: null } });
    await db.$transaction([
      db.treatmentPlan.deleteMany({ where: { patientId: pid } }), // items, consent and sessions cascade
      db.attachment.deleteMany({ where: { patientId: pid } }),
      db.assessment.deleteMany({ where: { patientId: pid } }),
      db.intakeForm.deleteMany({ where: { OR: [{ patientId: pid }, ...(leadId ? [{ leadId }] : [])] } }),
      db.progressEntry.deleteMany({ where: { patientId: pid } }),
      db.followUp.deleteMany({ where: { patientId: pid } }),
      db.feedback.deleteMany({ where: { patientId: pid } }),
    ]);
    for (const f of files) await deleteEncryptedFile(f.storageKey).catch(() => undefined);

    const charges = await db.charge.findMany({ where: { patientId: pid } });
    const hasMoney = charges.length > 0 || (await db.payment.count({ where: { patientId: pid } })) > 0;
    if (hasMoney) {
      for (const c of charges) await db.charge.update({ where: { id: c.id }, data: { description: categoryLabel(c.category) } });
      await db.patientPackage.updateMany({ where: { patientId: pid }, data: { name: "Package" } });
      await db.payment.updateMany({ where: { patientId: pid }, data: { notes: null, reference: null } });
      await db.patient.update({
        where: { id: pid },
        data: {
          firstName: "Erased", lastName: `patient ${patient.patientNo}`, birthDate: null, sex: null, mobile: null, email: null,
          address: null, occupation: null, emergencyContact: null, leadId: null,
        },
      });
    } else {
      await db.patient.delete({ where: { id: pid } });
    }
  }

  if (leadId) {
    const future = await db.appointment.findMany({ where: { leadId, status: { in: ["BOOKED", "CONFIRMED"] }, startAt: { gt: new Date() } } });
    await db.$transaction([
      db.conversation.deleteMany({ where: { leadId } }), // messages cascade
      db.intakeForm.deleteMany({ where: { leadId } }),
      db.appointment.updateMany({ where: { leadId }, data: { notes: null } }),
      db.appointment.updateMany({ where: { id: { in: future.map((a) => a.id) } }, data: { status: "CANCELLED" } }),
      db.lead.update({
        where: { id: leadId },
        data: { firstName: "Erased", lastName: null, mobile: null, email: null, psid: null, concernEnc: null, notes: null },
      }),
    ]);
    // Remove names from Google Calendar too.
    for (const a of await db.appointment.findMany({ where: { leadId, googleEventId: { not: null } }, select: { id: true } })) {
      await pushAppointment(a.id).catch(() => undefined);
    }
  }

  await audit({ userId, action: "ERASE", entity: patient ? "Patient" : "Lead", entityId: patient?.id ?? leadId, detail: `erased ${ref}: ${reason.slice(0, 100)}` });
  return { ref };
}
