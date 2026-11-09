import type { Metadata } from "next";
import Link from "next/link";
import { campaignCodeFrom } from "@/lib/funnel";
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
  return (
    <main lang={lang === "en" ? "en" : "fil"} className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cm-navy to-cm-blue p-4">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-7 text-center shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/logo.jpg" alt="Clinica Medica 101" width={72} height={72} className="mx-auto h-[72px] w-[72px] rounded-full" />
        <h1 className="text-2xl font-bold text-cm-navy">{t.thanksTitle}</h1>
        <p className="text-sm">{t.thanksBody}</p>
        {messenger && (
          <p className="text-sm">
            {t.thanksFaster} <a href={messenger} className="font-medium text-cm-blue underline">{t.thanksMessenger}</a>.
          </p>
        )}
        <Link href={`${pagePath(from)}${code ? `?c=${code}` : ""}`} className="btn-secondary">{t.back}</Link>
      </div>
    </main>
  );
}
