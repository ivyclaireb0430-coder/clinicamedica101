import type { Metadata } from "next";
import Link from "next/link";
import { campaignCodeFrom } from "@/lib/funnel";

// Separate thank-you URL so ad platforms can count a "Lead" conversion when this page loads.
export const metadata: Metadata = { title: "Salamat po! · Clinica Medica 101", robots: { index: false } };

export default async function ThankYouPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const code = campaignCodeFrom(await searchParams);
  const page = process.env.FB_PAGE_USERNAME;
  const messenger = page ? `https://m.me/${page}${code ? `?ref=${encodeURIComponent(code)}` : ""}` : null;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cm-navy to-cm-blue p-4">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-7 text-center shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/logo.jpg" alt="Clinica Medica 101" width={72} height={72} className="mx-auto h-[72px] w-[72px] rounded-full" />
        <h1 className="text-2xl font-bold text-cm-navy">Salamat po!</h1>
        <p className="text-sm">
          Natanggap na namin ang inyong inquiry. Kokontakin kayo ng aming front desk sa lalong madaling panahon (karaniwan sa loob
          ng isang araw, Lunes hanggang Sabado).
        </p>
        {messenger && (
          <p className="text-sm">
            Gusto ninyo ng mas mabilis na sagot? <a href={messenger} className="font-medium text-cm-blue underline">Mag-message sa amin sa Messenger</a>.
          </p>
        )}
        <Link href={`/start${code ? `?c=${code}` : ""}`} className="btn-secondary">Bumalik</Link>
      </div>
    </main>
  );
}
