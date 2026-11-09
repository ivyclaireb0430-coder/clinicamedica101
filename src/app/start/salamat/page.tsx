import type { Metadata } from "next";
import Link from "next/link";
import { campaignCodeFrom, telHref } from "@/lib/funnel";
import { getSetting } from "@/lib/settings";
import { UI, isLandingPage, pageLang, pagePath } from "@/lib/landing-content";
import { messengerLink } from "../LandingView";

// Separate thank-you URL so ad platforms can count a "Lead" conversion when this page loads.
export const metadata: Metadata = { title: "Salamat po! · Clinica Medica 101", robots: { index: false } };

export default async function ThankYouPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const code = campaignCodeFrom(sp);
  const from = isLandingPage(sp.from) ? sp.from : "start";
  const lang = pageLang(from);
  const t = UI[lang];
  const messenger = messengerLink(code);
  const phone = await getSetting("clinicPhone");
  const tel = telHref(phone);
  // Display only: the booking itself is already saved. Ignore anything that isn't a date.
  const bookedRaw = typeof sp.booked === "string" ? new Date(sp.booked) : null;
  const booked = bookedRaw && !Number.isNaN(bookedRaw.getTime()) ? bookedRaw : null;
  const when = booked
    ? new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(booked)
    : "";
  return (
    <main lang={lang === "en" ? "en" : "fil"} className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cm-navy to-cm-blue p-4">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-7 text-center shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/logo.jpg" alt="Clinica Medica 101" width={72} height={72} className="mx-auto h-[72px] w-[72px] rounded-full" />
        <h1 className="text-2xl font-bold text-cm-navy">{booked ? t.bookedTitle : t.thanksTitle}</h1>
        {booked && <p className="rounded-2xl bg-cm-mint px-4 py-3 text-lg font-bold text-cm-navy">{when}</p>}
        <p className="text-sm">{booked ? t.bookedBody(when) : t.thanksBody}</p>
        {messenger && (
          <p className="text-sm">
            {t.thanksFaster} <a href={messenger} className="font-medium text-cm-blue underline">{t.thanksMessenger}</a>.
          </p>
        )}
        {tel && (
          <p className="text-sm">
            {t.thanksCall} <a href={tel} className="font-semibold text-cm-blue underline">{phone}</a>.
          </p>
        )}
        <Link href={`${pagePath(from)}${code ? `?c=${code}` : ""}`} className="btn-secondary">{t.back}</Link>
      </div>
    </main>
  );
}
