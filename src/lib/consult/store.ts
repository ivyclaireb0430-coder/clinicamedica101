import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "../db";
import { audit } from "../audit";
import { decrypt, decryptJson, encrypt } from "../crypto";
import { sendEmail } from "../email";
import { doctorEmail } from "../google";
import { getNumberSetting, getSetting, setSetting } from "../settings";
import { todayManila } from "../time";
import { aiApiKey } from "../messenger/ai-context";
import { sendToContact } from "../outreach";
import { ageFromBirthDate, type ConsultLessonKind, type ConsultLine, type ConsultProfile, type ConsultSummary } from "./ai";

export const CONSULT_STATUSES = ["ACTIVE", "EMERGENCY", "SUBMITTED", "SENT", "CLOSED"] as const;
export const CONSULT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Kausap pa ang AI",
  EMERGENCY: "Emergency",
  SUBMITTED: "Para kay Doc",
  SENT: "Nasagot na ni Doc",
  CLOSED: "Sarado",
};

export type RxLine = { drug: string; form: string; sig: string; qty: string };

export async function consultDoctorName(): Promise<string> {
  return (await getSetting("consultDoctorName")) || (await getSetting("landingDoctorName")) || "ang doktor";
}

/** Online konsulta is open to patients: switched on and an AI key is available. */
export async function consultOpen(): Promise<boolean> {
  return (await getSetting("consultEnabled")) === "1" && Boolean(await aiApiKey());
}

export function newConsultToken(): string {
  return randomBytes(24).toString("base64url");
}

export function consultUrl(token: string): string {
  return `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/konsulta/${token}`;
}

/** Count one AI call against today's konsulta cap. False when the cap is reached. */
export async function takeConsultQuota(): Promise<boolean> {
  const today = todayManila();
  const [day, count] = (await getSetting("consultUsage")).split(":");
  const used = day === today ? Number(count) || 0 : 0;
  if (used >= (await getNumberSetting("consultDailyLimit"))) return false;
  await setSetting("consultUsage", `${today}:${used + 1}`);
  return true;
}

export type ConsultLessonRow = { id: string; kind: ConsultLessonKind; text: string; createdAt: Date };

export async function loadConsultLessons(): Promise<ConsultLessonRow[]> {
  const rows = await db.consultLesson.findMany({ orderBy: { createdAt: "asc" }, take: 300 });
  return rows.map((r) => ({ ...r, kind: (["STYLE", "QUESTION", "ADVICE", "FACT"].includes(r.kind) ? r.kind : "STYLE") as ConsultLessonKind }));
}

export async function loadConsultLines(sessionId: string): Promise<ConsultLine[]> {
  const rows = await db.consultMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" }, take: 300 });
  return rows
    .filter((m) => m.sender !== "SYSTEM")
    .map((m) => ({ from: m.sender === "PATIENT" ? "patient" : m.sender === "DOCTOR" ? "doctor" : "ai", text: decrypt(m.textEnc) }));
}

export async function consultProfile(session: { firstName: string; birthDate: string | null; sex: string | null }): Promise<ConsultProfile> {
  const [doctorName, clinicName, feeNote, lessons] = await Promise.all([
    consultDoctorName(),
    getSetting("clinicName"),
    getSetting("consultFeeNote"),
    loadConsultLessons(),
  ]);
  return {
    doctorName,
    clinicName,
    feeNote,
    lessons: lessons.map((l) => ({ kind: l.kind, text: l.text })),
    patient: { firstName: session.firstName, age: ageFromBirthDate(session.birthDate, todayManila()), sex: session.sex },
  };
}

export async function addConsultMessage(sessionId: string, sender: "PATIENT" | "AI" | "SYSTEM" | "DOCTOR", text: string) {
  const now = new Date();
  await db.$transaction([
    db.consultMessage.create({ data: { sessionId, sender, textEnc: encrypt(text) } }),
    db.consultSession.update({ where: { id: sessionId }, data: { lastMessageAt: now } }),
  ]);
}

/**
 * Link the consult to a lead so it shows in the pipeline and the privacy tools (access export, erasure) cover it.
 * Prefers the Messenger lead the patient came from, then an open lead with the same mobile, else a new lead.
 */
export async function linkConsultLead(input: { firstName: string; lastName: string | null; mobile: string; email: string | null; leadId?: string | null }, now = new Date()) {
  const note = `${todayManila(now)} Online konsulta`;
  const existing = input.leadId
    ? await db.lead.findUnique({ where: { id: input.leadId } })
    : await db.lead.findFirst({ where: { mobile: input.mobile, stage: { not: "LOST" } }, orderBy: { createdAt: "desc" } });
  if (existing) {
    await db.lead.update({
      where: { id: existing.id },
      data: {
        lastContactAt: now,
        firstName: existing.firstName === "Messenger user" ? input.firstName : existing.firstName,
        lastName: existing.lastName ?? input.lastName,
        mobile: existing.mobile ?? input.mobile,
        email: existing.email ?? input.email,
        privacyConsent: true,
        consentAt: existing.consentAt ?? now,
        notes: [existing.notes, note].filter(Boolean).join("\n").slice(-2000),
      },
    });
    const patient = await db.patient.findUnique({ where: { leadId: existing.id }, select: { id: true } });
    return { leadId: existing.id, patientId: patient?.id ?? null };
  }
  const lead = await db.lead.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      mobile: input.mobile,
      email: input.email,
      source: "WEBSITE",
      landingPage: "konsulta",
      privacyConsent: true,
      consentAt: now,
      notes: note,
      stageChanges: { create: { toStage: "NEW" } },
    },
  });
  await audit({ action: "CREATE", entity: "Lead", entityId: lead.id, detail: "online konsulta" });
  return { leadId: lead.id, patientId: null };
}

const CONSULT_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;

/** Email the doctor that konsulta chats wait for her. Counts and a link only, no patient details. Emergencies skip the throttle. */
export async function notifyDoctorConsult(opts: { emergency?: boolean } = {}, now = new Date()): Promise<void> {
  const last = await getSetting("lastConsultNotifyAt");
  if (!opts.emergency && last && now.getTime() - new Date(last).getTime() < CONSULT_NOTIFY_THROTTLE_MS) return;
  const to = await doctorEmail();
  if (!to) return;
  const [waiting, emergencies] = await Promise.all([
    db.consultSession.count({ where: { status: "SUBMITTED" } }),
    db.consultSession.count({ where: { status: "EMERGENCY", closedAt: null } }),
  ]);
  const subject = opts.emergency
    ? "⚠️ Clinica Medica 101: possible emergency in an online konsulta"
    : `Clinica Medica 101: ${waiting} online konsulta ${waiting === 1 ? "waits" : "wait"} for your review`;
  const body = [
    opts.emergency ? "May online konsulta na mukhang emergency. Sinabihan na ang pasyente na pumunta sa ER o tumawag sa 911." : "",
    `Para kay Doc: ${waiting}. Emergency na hindi pa sarado: ${emergencies}.`,
    `Buksan: ${process.env.APP_URL ?? ""}/consults`,
    "(Walang patient details sa email na ito para sa privacy.)",
  ]
    .filter(Boolean)
    .join("\n\n");
  const result = await sendEmail(to, subject, body).catch(() => ({ ok: false }));
  if (result.ok) await setSetting("lastConsultNotifyAt", now.toISOString());
}

/** Tell the patient the doctor replied. The message has a link only, no health details. */
export async function notifyPatientConsult(sessionId: string) {
  const s = await db.consultSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { lead: { select: { conversation: { select: { id: true, psid: true, lastUserMessageAt: true } } } } },
  });
  const doctor = await consultDoctorName();
  const text = `Hi ${s.firstName}! Nakasagot na po si ${doctor} sa inyong online konsulta. Buksan po ito para mabasa: ${consultUrl(s.token)}`;
  return sendToContact(
    { firstName: s.firstName, email: s.email, mobile: s.mobile, conversation: s.lead?.conversation ?? null },
    text,
    { subject: `Sagot ni ${doctor} sa inyong online konsulta` },
  );
}

export function readSummary(session: { summaryEnc: string | null }): ConsultSummary | null {
  return decryptJson<ConsultSummary>(session.summaryEnc);
}

export function readPrescription(session: { prescriptionEnc: string | null }): RxLine[] {
  return decryptJson<RxLine[]>(session.prescriptionEnc) ?? [];
}

/** Mobile number check, so a forwarded or leaked link alone doesn't open the chat or the doctor's reply. */
export function mobileMatches(stored: string, typed: string): boolean {
  const digits = (s: string) => s.replace(/\D/g, "").slice(-10);
  const a = digits(stored);
  const b = digits(typed);
  return a.length === 10 && a === b;
}

export const CONSULT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export function consultCookieName(sessionId: string): string {
  return `konsulta_${sessionId}`;
}

/** Cookie value proving this browser started the consult or typed the right mobile number. */
export function consultCookieValue(sessionId: string): string {
  const key = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET || "";
  return createHmac("sha256", key).update(`konsulta:${sessionId}`).digest("base64url");
}

export function consultCookieValid(sessionId: string, value: string | undefined): boolean {
  if (!value) return false;
  const expected = consultCookieValue(sessionId);
  return value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

/** Everything the e-reseta needs for one consult. */
export async function resetaProps(session: {
  id: string;
  firstName: string;
  lastName: string | null;
  birthDate: string | null;
  sex: string | null;
  sentAt: Date | null;
  prescriptionEnc: string | null;
}) {
  const { formatDate } = await import("../time");
  const [clinicName, clinicAddress, clinicPhone, doctorName, licenseNo, ptrNo, s2No] = await Promise.all([
    getSetting("clinicName"),
    getSetting("clinicAddress"),
    getSetting("clinicPhone"),
    consultDoctorName(),
    getSetting("consultLicenseNo"),
    getSetting("consultPtrNo"),
    getSetting("consultS2No"),
  ]);
  return {
    clinicName,
    clinicAddress,
    clinicPhone,
    doctorName,
    licenseNo,
    ptrNo,
    s2No,
    patientName: [session.firstName, session.lastName].filter(Boolean).join(" "),
    age: ageFromBirthDate(session.birthDate, todayManila()),
    sex: session.sex && session.sex !== "UNDISCLOSED" ? session.sex : null,
    date: formatDate(session.sentAt ?? new Date()),
    lines: readPrescription(session),
    reference: `OK-${session.id.slice(-8).toUpperCase()}`,
  };
}
