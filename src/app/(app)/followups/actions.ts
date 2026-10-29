"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { FOLLOW_UP_KIND_KEYS, requestFeedback, sendFollowUpReminder } from "@/lib/followup";
import { todayManila } from "@/lib/time";

const text = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const safeBack = (back: string) => (back.startsWith("/") && !back.startsWith("//") ? back : "/followups");
const withFlash = (back: string, flash: string) => `${safeBack(back)}${back.includes("?") ? "&" : "?"}${flash}`;

export async function addFollowUp(patientId: string, fd: FormData) {
  const user = await requirePermission("booking:write");
  const parsed = z
    .object({ dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), kind: z.enum(FOLLOW_UP_KIND_KEYS), note: z.string().max(200).nullable() })
    .safeParse({ dueDate: text(fd, "dueDate"), kind: text(fd, "kind"), note: text(fd, "note") });
  if (!parsed.success) redirect(`/patients/${patientId}?tab=followup&error=${encodeURIComponent("Choose a follow-up date and type")}`);
  const fu = await db.followUp.create({ data: { patientId, ...parsed.data!, createdById: user.id } });
  await audit({ userId: user.id, action: "CREATE", entity: "FollowUp", entityId: fu.id });
  redirect(`/patients/${patientId}?tab=followup&saved=1`);
}

export async function setFollowUpStatus(id: string, status: "DONE" | "CANCELLED" | "OPEN", back: string) {
  const user = await requirePermission("booking:write");
  await db.followUp.update({ where: { id }, data: { status, completedAt: status === "OPEN" ? null : new Date() } });
  await audit({ userId: user.id, action: "UPDATE", entity: "FollowUp", entityId: id, detail: `status=${status}` });
  redirect(safeBack(back));
}

export async function sendFollowUpNow(id: string, back: string) {
  await requirePermission("booking:write");
  const fu = await db.followUp.findUniqueOrThrow({ where: { id } });
  const r = await sendFollowUpReminder(id, fu.dueDate < todayManila() ? "OVERDUE" : "DUE");
  redirect(withFlash(back, `sent=${r.ok ? r.channel : "failed"}`));
}

/** Recall list: create a check-in follow-up for today and send the recall message. */
export async function recallPatient(patientId: string, kind: "INACTIVE" | "MISSED", back: string) {
  const user = await requirePermission("booking:write");
  const fu = await db.followUp.create({
    data: { patientId, dueDate: todayManila(), kind: kind === "MISSED" ? "NEXT_SESSION" : "CHECK_IN", note: kind === "MISSED" ? "Missed-session recall" : "Inactive recall", createdById: user.id },
  });
  const r = await sendFollowUpReminder(fu.id, kind);
  redirect(withFlash(back, `sent=${r.ok ? r.channel : "failed"}`));
}

export async function sendFeedbackRequest(patientId: string, back: string) {
  await requirePermission("booking:write");
  const { result } = await requestFeedback(patientId, null);
  redirect(withFlash(back, `sent=${result.ok ? result.channel : "failed"}`));
}

export async function setTestimonialHidden(feedbackId: string, hidden: boolean) {
  const user = await requirePermission("feedback:read");
  await db.feedback.update({ where: { id: feedbackId }, data: { testimonialHidden: hidden } });
  await audit({ userId: user.id, action: "UPDATE", entity: "Feedback", entityId: feedbackId, detail: hidden ? "testimonial hidden" : "testimonial shown" });
  redirect("/followups?tab=feedback");
}
