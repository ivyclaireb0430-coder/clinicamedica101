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
    <main className="mx-auto max-w-lg p-6">
      <div className="card space-y-3 text-center">
        <h1>Salamat po! 💚</h1>
        <p className="text-sm">
          Natanggap na namin ang inyong inquiry. Kokontakin kayo ng aming front desk sa lalong madaling panahon (karaniwan sa loob
          ng isang araw, Lunes hanggang Sabado).
        </p>
        {messenger && (
          <p className="text-sm">
            Gusto ninyo ng mas mabilis na sagot? <a href={messenger} className="text-brand-700 underline">Mag-message sa amin sa Messenger</a>.
          </p>
        )}
        <Link href={`/start${code ? `?c=${code}` : ""}`} className="btn-secondary">Bumalik</Link>
      </div>
    </main>
  );
}
