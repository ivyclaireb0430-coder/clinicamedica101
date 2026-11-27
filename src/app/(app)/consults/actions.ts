"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { decryptOptional, encrypt, encryptJson } from "@/lib/crypto";
import { requirePermission } from "@/lib/session";
import { addConsultMessage, notifyPatientConsult } from "@/lib/consult/store";
import { dangerousDrug } from "@/lib/consult/ai";

const rxSchema = z.array(
  z.object({
    drug: z.string().trim().min(1).max(160),
    form: z.string().trim().max(120).default(""),
    sig: z.string().trim().min(1).max(300),
    qty: z.string().trim().max(40).default(""),
  }),
).max(12);

const replySchema = z.object({ note: z.string().trim().min(1, "Isulat ang mensahe ninyo sa pasyente.").max(6000), rx: rxSchema, needsVisit: z.boolean().default(false) });

export async function approveConsult(id: string, input: { note: string; rx: unknown; needsVisit?: boolean }): Promise<{ error?: string; channel?: string }> {
  const user = await requirePermission("consult:review");
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message || "Paki-check ang reseta: kailangan ang gamot at Sig." };
  const bad = dangerousDrug(parsed.data.rx);
  if (bad) return { error: `Hindi puwede ang ${bad} sa online konsulta (dangerous drug, kailangan ng S2 yellow form). Ipa-clinic visit ang pasyente.` };
  const session = await db.consultSession.findUnique({ where: { id } });
  if (!session || !["SUBMITTED", "EMERGENCY"].includes(session.status)) return { error: "Hindi na ito naghihintay ng review." };
  await db.consultSession.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      reviewedById: user.id,
      doctorNoteEnc: encrypt(parsed.data.note),
      needsVisit: parsed.data.needsVisit,
      prescriptionEnc: parsed.data.rx.length ? encryptJson(parsed.data.rx) : null,
      closedAt: session.status === "EMERGENCY" ? new Date() : null,
    },
  });
  await audit({ userId: user.id, action: "APPROVE", entity: "ConsultSession", entityId: id, detail: `doctor reply sent${parsed.data.needsVisit ? ", in-clinic visit needed" : ""}${parsed.data.rx.length ? ` with e-reseta (${parsed.data.rx.length} item)` : ""}` });
  const sent = await notifyPatientConsult(id).catch((e: Error) => ({ ok: false, channel: "FAILED", error: e.message }));
  revalidatePath("/consults");
  revalidatePath(`/consults/${id}`);
  return { channel: sent.ok ? sent.channel : `hindi naipadala ang abiso (${sent.channel})` };
}

/** Doctor needs more information: her question goes to the patient and the AI chat opens again. */
export async function askPatient(id: string, formData: FormData) {
  const user = await requirePermission("consult:review");
  const question = z.string().trim().min(1).max(2000).parse(formData.get("question"));
  const session = await db.consultSession.findUnique({ where: { id } });
  if (!session || session.status !== "SUBMITTED") redirect(`/consults/${id}`);
  await addConsultMessage(id, "DOCTOR", question);
  await db.consultSession.update({ where: { id }, data: { status: "ACTIVE", submittedAt: null } });
  await audit({ userId: user.id, action: "UPDATE", entity: "ConsultSession", entityId: id, detail: "doctor asked the patient a follow-up question" });
  await notifyPatientConsult(id).catch(() => undefined);
  revalidatePath("/consults");
  redirect(`/consults/${id}`);
}

export async function closeConsult(id: string, formData: FormData) {
  const user = await requirePermission("consult:review");
  const reason = z.string().trim().max(200).parse(formData.get("reason") ?? "");
  await db.consultSession.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date(), reviewedById: user.id } });
  await audit({ userId: user.id, action: "CLOSE", entity: "ConsultSession", entityId: id, detail: reason ? `closed: ${reason}` : "closed" });
  revalidatePath("/consults");
  redirect(`/consults/${id}`);
}

/** Text for "learn from my edit" in the trainer: the AI's draft vs what the doctor sent, names removed. */
export async function editLessonStart(id: string): Promise<{ text?: string; error?: string }> {
  await requirePermission("consult:train");
  const s = await db.consultSession.findUnique({ where: { id } });
  const draft = decryptOptional(s?.draftNoteEnc);
  const final = decryptOptional(s?.doctorNoteEnc);
  if (!s || !draft || !final) return { error: "Walang draft o final na sagot para ikumpara." };
  const { editLessonStarter } = await import("@/lib/consult/trainer");
  return { text: editLessonStarter(draft, final, [s.firstName, s.lastName ?? ""]) };
}
