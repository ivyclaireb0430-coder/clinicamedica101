"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createRateLimiter, inquiryErrorMessage, landingInquirySchema } from "@/lib/funnel";
import { campaignByCode, isOpenSlot, notifyWebInquiry, saveWebInquiry, webBookingType } from "@/lib/funnel-db";
import { SlotTakenError, createAppointment } from "@/lib/booking";
import { isLandingPage, pageLang, pagePath } from "@/lib/landing-content";
import { getSetting } from "@/lib/settings";

// 5 submissions per hour per IP address (the address is only kept in memory, never stored).
const allow = createRateLimiter(5, 60 * 60 * 1000);

export async function submitLandingInquiry(code: string | null, pageIdRaw: string, formData: FormData) {
  // Bound arguments come back from the browser, so check them again.
  const pageId = isLandingPage(pageIdRaw) ? pageIdRaw : "start";
  const safeCode = code && /^[a-z0-9][a-z0-9_-]{0,59}$/.test(code) ? code : null;
  const lang = pageLang(pageId);
  const path = pagePath(pageId);
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(safeCode ? { c: safeCode } : {}), ...extra }).toString();
  const back = (error: string) => redirect(`${path}?${qs({ error })}#form`);
  const thanks = `/start/salamat?${qs({ from: pageId })}`;

  if ((await getSetting("landingEnabled")) !== "1") redirect(path);

  // Honeypot: real people never see or fill the "website" field.
  if (String(formData.get("website") ?? "") !== "") redirect(thanks);

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!allow(ip)) back(inquiryErrorMessage("rate", lang));

  const parsed = landingInquirySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(inquiryErrorMessage(String(parsed.error.issues[0]?.path[0] ?? ""), lang));
  const data = parsed.data!;

  // Self-booking: check the slot before saving anything, then book it right after the lead is saved.
  const type = data.slotStart ? await webBookingType() : null;
  if (data.slotStart && (!type || !(await isOpenSlot(type.id, data.slotStart)))) back(inquiryErrorMessage("taken", lang));

  const campaign = await campaignByCode(safeCode);
  const lead = await saveWebInquiry(data, campaign, pageId);
  let booked: Date | null = null;
  if (data.slotStart && type) {
    try {
      await createAppointment({ leadId: lead.id, consultationTypeId: type.id, startAt: data.slotStart, channel: "WEBSITE", notes: "Booked online from the landing page" });
      booked = data.slotStart;
    } catch (err) {
      if (err instanceof SlotTakenError) back(inquiryErrorMessage("taken", lang));
      throw err;
    }
  }
  await notifyWebInquiry().catch(() => undefined);
  redirect(booked ? `/start/salamat?${qs({ from: pageId, booked: booked.toISOString() })}` : thanks);
}
