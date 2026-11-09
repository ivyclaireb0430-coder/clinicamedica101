import { db } from "./db";
import { decryptOptional, encryptOptional } from "./crypto";
import { audit } from "./audit";
import { getSetting, setSetting } from "./settings";
import { doctorEmail, sendGmail } from "./google";
import { addDays, manilaDateString, todayManila } from "./time";
import { getOpenSlots } from "./booking";
import { testimonialName } from "./followup";
import { inquiryNote, spreadSlots, type LandingInquiry } from "./funnel";
import { LANDING_PAGE_LABELS, type LandingPageId } from "./landing-content";

export async function campaignByCode(code: string | null) {
  if (!code) return null;
  return db.campaign.findUnique({ where: { trackingCode: code }, select: { id: true, name: true, trackingCode: true } });
}

/** Count one landing page view for today (Manila) and the campaign, if any. Anonymous. */
export async function recordLandingVisit(campaignId: string | null, page: LandingPageId = "start", now = new Date()) {
  const day = manilaDateString(now);
  const campaignKey = campaignId ?? "";
  await db.landingVisit.upsert({
    where: { day_campaignKey_page: { day, campaignKey, page } },
    create: { day, campaignKey, page, count: 1 },
    update: { count: { increment: 1 } },
  });
}

/** Landing page visits between two Manila dates (inclusive), by campaign id ("none" = no campaign) and by page. */
export async function landingVisits(start: string, end: string) {
  const rows = await db.landingVisit.findMany({ where: { day: { gte: start, lte: end } } });
  const byCampaign = new Map<string, number>();
  const byPage = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    const key = r.campaignKey || "none";
    byCampaign.set(key, (byCampaign.get(key) ?? 0) + r.count);
    byPage.set(r.page, (byPage.get(r.page) ?? 0) + r.count);
    total += r.count;
  }
  return { byCampaign, byPage, total };
}

/**
 * Save a web form inquiry as a lead. If the same mobile number already has an open (not lost) inquiry
 * that has not become a patient, update that one instead of creating a duplicate.
 */
export async function saveWebInquiry(
  input: LandingInquiry,
  campaign: { id: string; name: string } | null,
  page: LandingPageId = "start",
  now = new Date(),
) {
  const pageNote = page === "start" ? "" : ` [${LANDING_PAGE_LABELS[page]}]`;
  const note = inquiryNote(input, campaign?.name, await getSetting("landingPromoName")) + pageNote;
  const existing = await db.lead.findFirst({
    where: { mobile: input.mobile, stage: { not: "LOST" }, patient: null },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await db.lead.update({
      where: { id: existing.id },
      data: {
        lastContactAt: now,
        email: existing.email ?? input.email ?? null,
        campaignId: existing.campaignId ?? campaign?.id ?? null,
        concernEnc: input.concern ? encryptOptional(input.concern) : existing.concernEnc,
        privacyConsent: true,
        consentAt: existing.consentAt ?? now,
        notes: [existing.notes, `${manilaDateString(now)} ${note}`].filter(Boolean).join("\n").slice(-2000),
      },
    });
    await audit({ action: "UPDATE", entity: "Lead", entityId: existing.id, detail: "repeat web form inquiry" });
    return { id: existing.id, created: false };
  }
  const lead = await db.lead.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      mobile: input.mobile,
      email: input.email ?? null,
      source: "WEBSITE",
      landingPage: page,
      campaignId: campaign?.id ?? null,
      concernEnc: encryptOptional(input.concern),
      privacyConsent: true,
      consentAt: now,
      firstContactAt: now,
      lastContactAt: now,
      notes: note,
      stageChanges: { create: { toStage: "NEW" } },
    },
  });
  await audit({ action: "CREATE", entity: "Lead", entityId: lead.id, detail: "web form inquiry" });
  return { id: lead.id, created: true };
}

const WEB_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;

/** Email the clinic that new web inquiries are waiting. A count and a link only, no patient details. */
export async function notifyWebInquiry(now = new Date()): Promise<void> {
  const last = await getSetting("lastWebLeadNotifyAt");
  if (last && now.getTime() - new Date(last).getTime() < WEB_NOTIFY_THROTTLE_MS) return;
  const to = await doctorEmail();
  if (!to) return;
  const [count, booked] = await Promise.all([
    db.lead.count({ where: { source: "WEBSITE", stage: "NEW" } }),
    db.appointment.count({ where: { channel: "WEBSITE", createdAt: { gte: new Date(now.getTime() - 86_400_000) } } }),
  ]);
  if (count + booked === 0) return;
  const app = process.env.APP_URL ?? "";
  const result = await sendGmail(
    to,
    `Clinica Medica 101: website — ${booked} online ${booked === 1 ? "booking" : "bookings"}, ${count} ${count === 1 ? "inquiry" : "inquiries"} to call`,
    [
      `Galing sa landing page:`,
      `- ${booked} online booking sa nakaraang 24 oras (i-confirm sa pasyente): ${app}/calendar`,
      `- ${count} inquiry na hindi pa natatawagan: ${app}/leads?stage=NEW`,
      ``,
      `(Walang patient details sa email na ito para sa privacy.)`,
    ].join("\n"),
  ).catch(() => ({ ok: false }));
  if (result.ok) await setSetting("lastWebLeadNotifyAt", now.toISOString());
}

/** Testimonials the patient agreed to share: 4–5 stars, with a comment, not hidden by the owner. */
export async function publicTestimonials(limit = 6) {
  const rows = await db.feedback.findMany({
    where: { testimonialConsent: true, testimonialHidden: false, rating: { gte: 4 }, commentEnc: { not: null } },
    orderBy: { submittedAt: "desc" },
    take: limit,
    select: { rating: true, commentEnc: true, displayName: true, patient: { select: { firstName: true, lastName: true } } },
  });
  return rows
    .map((r) => ({ rating: r.rating ?? 5, text: decryptOptional(r.commentEnc)?.trim() ?? "", name: testimonialName(r.patient, r.displayName ?? "INITIAL") }))
    .filter((t) => t.text.length >= 10);
}

export type BookableDay = { date: string; slots: string[] }; // slots: ISO start times

/**
 * Open slots for self-booking on the landing page: the next `days` days with at least one opening,
 * at most `perDay` times each (spread across the day so people see morning and afternoon choices).
 */
export async function bookableDays(consultationTypeId: string, days = 14, perDay = 8, now = new Date()): Promise<BookableDay[]> {
  const out: BookableDay[] = [];
  const today = todayManila(now);
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const open = await getOpenSlots(date, consultationTypeId, now);
    if (open.length) out.push({ date, slots: spreadSlots(open, perDay).map((s) => s.startAt.toISOString()) });
  }
  return out;
}

/** The consultation type booked from the landing page: the first active one (Initial consultation). */
export async function webBookingType() {
  return db.consultationType.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

/** Is `startAt` still an open slot for this type? */
export async function isOpenSlot(consultationTypeId: string, startAt: Date, now = new Date()) {
  const open = await getOpenSlots(manilaDateString(startAt), consultationTypeId, now);
  return open.some((s) => s.startAt.getTime() === startAt.getTime());
}
