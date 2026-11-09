"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createRateLimiter, landingInquirySchema } from "@/lib/funnel";
import { campaignByCode, notifyWebInquiry, saveWebInquiry } from "@/lib/funnel-db";
import { getSetting } from "@/lib/settings";

// 5 submissions per hour per IP address (the address is only kept in memory, never stored).
const allow = createRateLimiter(5, 60 * 60 * 1000);

export async function submitLandingInquiry(code: string | null, formData: FormData) {
  const back = (error: string) => redirect(`/start?${new URLSearchParams({ ...(code ? { c: code } : {}), error })}#form`);
  if ((await getSetting("landingEnabled")) !== "1") redirect("/start");

  // Honeypot: real people never see or fill the "website" field.
  if (String(formData.get("website") ?? "") !== "") redirect(`/start/salamat${code ? `?c=${code}` : ""}`);

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!allow(ip)) back("Masyadong maraming submission. Pakisubukan ulit mamaya o mag-message sa amin sa Facebook.");

  const parsed = landingInquirySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(parsed.error.issues[0]?.message ?? "Pakisuri ang form");
  const campaign = await campaignByCode(code);
  await saveWebInquiry(parsed.data!, campaign);
  await notifyWebInquiry().catch(() => undefined);
  redirect(`/start/salamat${code ? `?c=${encodeURIComponent(code)}` : ""}`);
}
