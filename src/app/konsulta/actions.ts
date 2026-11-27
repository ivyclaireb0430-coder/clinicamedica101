"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { encrypt, encryptJson } from "@/lib/crypto";
import { saveEncryptedFile, validateUpload } from "@/lib/files";
import { verifyBookingToken } from "@/lib/messenger/booking-link";
import { aiApiKey } from "@/lib/messenger/ai-context";
import { normalizeEmail, normalizePhMobile } from "@/lib/messenger/bot";
import { CONSULT_CONSENT_VERSION, decideConsultReply, generateConsultSummary } from "@/lib/consult/ai";
import {
  CONSULT_COOKIE_MAX_AGE,
  addConsultMessage,
  consultCookieName,
  consultCookieValid,
  consultCookieValue,
  consultOpen,
  consultProfile,
  linkConsultLead,
  loadConsultLines,
  mobileMatches,
  newConsultToken,
  notifyDoctorConsult,
  takeConsultQuota,
} from "@/lib/consult/store";

const startSchema = z.object({
  firstName: z.string().trim().min(1, "Ilagay ang pangalan").max(60),
  lastName: z.string().trim().max(60).optional(),
  mobile: z.string().trim().min(1, "Ilagay ang mobile number"),
  email: z.string().trim().max(120).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ilagay ang birthday"),
  sex: z.enum(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"]),
  m: z.string().max(120).optional(),
  consentPrivacy: z.literal("on", { errorMap: () => ({ message: "Kailangan ang privacy consent" }) }),
  consentAi: z.literal("on", { errorMap: () => ({ message: "Kailangan sumang-ayon na AI assistant ang kausap" }) }),
  consentEmergency: z.literal("on", { errorMap: () => ({ message: "Kailangan sumang-ayon sa emergency notice" }) }),
});

async function setConsultCookie(sessionId: string) {
  (await cookies()).set(consultCookieName(sessionId), consultCookieValue(sessionId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: CONSULT_COOKIE_MAX_AGE,
    path: "/konsulta",
  });
}

export async function startConsult(formData: FormData) {
  if (!(await consultOpen())) redirect("/konsulta");
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v !== ""));
  const parsed = startSchema.safeParse(raw);
  const back = (msg: string) => redirect(`/konsulta?error=${encodeURIComponent(msg)}${raw.m ? `&m=${encodeURIComponent(String(raw.m))}` : ""}`);
  if (!parsed.success) back(parsed.error.issues[0].message);
  const d = parsed.data!;
  const mobile = normalizePhMobile(d.mobile);
  if (!mobile) back("Paki-check ang mobile number (hal. 0917 123 4567)");
  const email = d.email ? normalizeEmail(d.email) : null;
  if (d.email && !email) back("Paki-check ang email");

  // Light abuse guard: at most 3 new konsulta per mobile number per day.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await db.consultSession.count({ where: { mobile: mobile!, createdAt: { gte: since } } })) >= 3) {
    back("Marami na pong konsulta ngayong araw mula sa numerong ito. Bukas na lang po ulit, o mag-book ng consultation sa clinic.");
  }

  const conversationId = d.m ? verifyBookingToken(d.m) : null;
  const conversation = conversationId ? await db.conversation.findUnique({ where: { id: conversationId }, select: { leadId: true } }) : null;
  const link = await linkConsultLead({ firstName: d.firstName, lastName: d.lastName ?? null, mobile: mobile!, email, leadId: conversation?.leadId });
  const now = new Date();
  const session = await db.consultSession.create({
    data: {
      token: newConsultToken(),
      channel: conversation ? "MESSENGER" : "WEBSITE",
      leadId: link.leadId,
      patientId: link.patientId,
      firstName: d.firstName,
      lastName: d.lastName ?? null,
      mobile: mobile!,
      email,
      birthDate: d.birthDate,
      sex: d.sex,
      consentVersion: CONSULT_CONSENT_VERSION,
      consentAt: now,
    },
  });
  await audit({ action: "CONSENT", entity: "ConsultSession", entityId: session.id, detail: `online konsulta consent ${CONSULT_CONSENT_VERSION}` });
  const doctor = (await consultProfile(session)).doctorName;
  await addConsultMessage(
    session.id,
    "AI",
    `Hi ${d.firstName}! Kumusta po kayo? Ito po ang ${doctor} AI, sinanay ni Doc mismo. Ikuwento lang po ninyo ang inyong nararamdaman, at babasahin ito ni ${doctor} bago siya sumagot at magreseta. Ano po ang pangunahing nararamdaman ninyo ngayon, at kailan po ito nagsimula?`,
  );
  await setConsultCookie(session.id);
  redirect(`/konsulta/${session.token}`);
}

async function sessionForPatient(token: string) {
  const session = await db.consultSession.findUnique({ where: { token } });
  if (!session) return null;
  const value = (await cookies()).get(consultCookieName(session.id))?.value;
  return consultCookieValid(session.id, value) ? session : null;
}

export async function verifyConsultMobile(token: string, formData: FormData) {
  const session = await db.consultSession.findUnique({ where: { token } });
  const typed = String(formData.get("mobile") ?? "");
  if (!session || !mobileMatches(session.mobile, typed)) {
    await audit({ action: "LOGIN_FAILED", entity: "ConsultSession", entityId: session?.id ?? null, detail: "konsulta link: wrong mobile" });
    redirect(`/konsulta/${token}?error=1`);
  }
  await setConsultCookie(session.id);
  await audit({ action: "VIEW", entity: "ConsultSession", entityId: session.id, detail: "patient opened konsulta link (mobile verified)" });
  redirect(`/konsulta/${token}`);
}

export type ChatResult = { error?: string; reply?: string; emergency?: boolean; readyForDoctor?: boolean };

export async function sendConsultMessage(token: string, text: string): Promise<ChatResult> {
  const session = await sessionForPatient(token);
  if (!session) return { error: "Expired na po ang session. I-refresh ang page." };
  if (session.status !== "ACTIVE") return { error: "Naipadala na po ito kay Doc." };
  const msg = z.string().trim().min(1).max(2000).safeParse(text);
  if (!msg.success) return { error: "Mag-type po ng mensahe (hanggang 2,000 letra)." };
  const count = await db.consultMessage.count({ where: { sessionId: session.id, sender: "PATIENT" } });
  if (count >= 60) return { error: "Mahaba na po ang usapan. Pindutin na po ang \"Ipadala kay Doc\"." };

  await addConsultMessage(session.id, "PATIENT", msg.data);
  const apiKey = await aiApiKey();
  const profile = await consultProfile(session);
  const history = await loadConsultLines(session.id);
  const quota = apiKey ? await takeConsultQuota() : false;
  const decision = await decideConsultReply(
    { text: msg.data, profile, history, apiKey: apiKey ?? "" },
    // No key or over the daily cap: same safe path as an AI failure.
    quota ? undefined : async () => null,
  );

  if (decision.kind === "emergency") {
    await addConsultMessage(session.id, "SYSTEM", decision.reply);
    await db.consultSession.update({ where: { id: session.id }, data: { status: "EMERGENCY", emergencyAt: new Date() } });
    await audit({ action: "EMERGENCY", entity: "ConsultSession", entityId: session.id, detail: "possible emergency: patient told to go to the ER / 911" });
    await notifyDoctorConsult({ emergency: true }).catch(() => undefined);
    return { reply: decision.reply, emergency: true };
  }
  await addConsultMessage(session.id, "AI", decision.reply);
  return { reply: decision.reply, readyForDoctor: decision.kind === "reply" && decision.readyForDoctor };
}

export async function submitConsultToDoctor(token: string): Promise<{ error?: string }> {
  const session = await sessionForPatient(token);
  if (!session) return { error: "Expired na po ang session. I-refresh ang page." };
  if (session.status !== "ACTIVE") return {};
  const history = await loadConsultLines(session.id);
  if (!history.some((l) => l.from === "patient")) return { error: "Ikuwento muna po ang inyong concern." };
  const apiKey = await aiApiKey();
  // The summary is for the doctor; without it she still sees the full chat.
  const summary = apiKey && (await takeConsultQuota()) ? await generateConsultSummary({ profile: await consultProfile(session), history, apiKey }) : null;
  await db.consultSession.update({
    where: { id: session.id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      summaryEnc: summary ? encryptJson(summary) : null,
      draftNoteEnc: summary?.draftMessageToPatient ? encrypt(summary.draftMessageToPatient) : null,
    },
  });
  await audit({ action: "SUBMIT", entity: "ConsultSession", entityId: session.id, detail: summary ? "sent to doctor with AI summary" : "sent to doctor (no AI summary)" });
  await notifyDoctorConsult().catch(() => undefined);
  return {};
}

export async function uploadConsultFile(token: string, formData: FormData): Promise<{ error?: string; name?: string }> {
  const session = await sessionForPatient(token);
  if (!session) return { error: "Expired na po ang session. I-refresh ang page." };
  if (session.status !== "ACTIVE") return { error: "Naipadala na po ito kay Doc." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Pumili po ng file." };
  const problem = validateUpload(file);
  if (problem) return { error: problem };
  if ((await db.consultFile.count({ where: { sessionId: session.id } })) >= 10) return { error: "Hanggang 10 files lang po." };
  const storageKey = await saveEncryptedFile(Buffer.from(await file.arrayBuffer()));
  const row = await db.consultFile.create({
    data: { sessionId: session.id, filenameEnc: encrypt(file.name.slice(0, 200)), mimeType: file.type, size: file.size, storageKey },
  });
  // The AI never sees the file itself, only that one was attached; the doctor opens it.
  await addConsultMessage(session.id, "PATIENT", `[Nag-attach ng file para kay Doc: ${file.type.startsWith("image/") ? "larawan" : "dokumento"}]`);
  await audit({ action: "CREATE", entity: "ConsultFile", entityId: row.id, detail: "uploaded by patient" });
  return { name: file.name };
}
