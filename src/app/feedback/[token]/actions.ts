"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { encryptOptional } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { TESTIMONIAL_CONSENT_VERSION, testimonialName } from "@/lib/followup";

const schema = z.object({
  rating: z.coerce.number().int().min(1, "Pumili ng rating").max(5),
  comment: z.string().trim().max(2000).optional(),
  testimonial: z.literal("on").optional(),
  displayName: z.enum(["FULL", "INITIAL", "ANONYMOUS"]).optional(),
});

export async function submitFeedback(token: string, fd: FormData) {
  const fb = await db.feedback.findUnique({ where: { token }, include: { patient: { select: { firstName: true, lastName: true } } } });
  if (!fb || fb.submittedAt || fb.expiresAt < new Date()) redirect(`/feedback/${token}`);
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/feedback/${token}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const d = parsed.data;
  const consent = d.testimonial === "on";
  await db.feedback.update({
    where: { id: fb.id },
    data: {
      submittedAt: new Date(),
      rating: d.rating,
      commentEnc: encryptOptional(d.comment || null),
      testimonialConsent: consent,
      displayName: consent ? testimonialName(fb.patient, d.displayName ?? "INITIAL") : null,
      consentVersion: consent ? TESTIMONIAL_CONSENT_VERSION : null,
    },
  });
  await audit({ action: "CREATE", entity: "Feedback", entityId: fb.id, detail: consent ? "with testimonial consent" : "no testimonial consent" });
  redirect(`/feedback/${token}?done=1`);
}
