import { db } from "@/lib/db";
import { DISPLAY_NAME_OPTIONS } from "@/lib/followup";
import { submitFeedback } from "./actions";

export const metadata = { title: "Feedback · Clinica Medica 101", robots: { index: false } };

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto max-w-lg p-6">
      <div className="card space-y-2 text-center">
        <h1>{title}</h1>
        <p className="text-sm">{body}</p>
      </div>
    </main>
  );
}

export default async function FeedbackPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const { token } = await params;
  const { done, error } = await searchParams;
  if (done) return <Notice title="Salamat po! 💚" body="Natanggap na namin ang inyong feedback. Malaking tulong po ito sa amin." />;
  const fb = await db.feedback.findUnique({ where: { token }, include: { patient: { select: { firstName: true } } } });
  if (!fb || fb.submittedAt || fb.expiresAt < new Date()) {
    return <Notice title="Hindi na magagamit ang link na ito" body="Maaaring nasagot na o expired na. Salamat po!" />;
  }

  return (
    <main className="mx-auto max-w-lg p-4 pb-16">
      <h1>Kumusta ang inyong visit, {fb.patient.firstName}?</h1>
      <p className="muted mb-4">Clinica Medica 101 · 1 minuto lang po</p>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form action={submitFeedback.bind(null, token)} className="space-y-4">
        <fieldset className="card">
          <legend className="label">Gaano kayo kasatisfy sa inyong visit? *</legend>
          <div className="mt-2 flex justify-between gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="flex flex-1 cursor-pointer flex-col items-center rounded-lg border border-slate-200 py-2 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                <input type="radio" name="rating" value={n} required className="sr-only" />
                <span className="text-2xl text-amber-400">{"★".repeat(n)}</span>
                <span className="muted text-xs">{["Hindi", "Medyo", "Okay", "Satisfied", "Sobrang satisfied"][n - 1]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="card">
          <label className="label" htmlFor="comment">Comments o suggestions (optional)</label>
          <textarea className="input" id="comment" name="comment" rows={4} maxLength={2000} placeholder="Ano ang nagustuhan ninyo? Ano ang puwede pa naming pagbutihin?" />
        </div>
        <div className="card space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="testimonial" className="mt-1" />
            <span>
              Pumapayag akong gamitin ng Clinica Medica 101 ang aking comment bilang testimonial (hal. sa Facebook page o website).
              Hindi isasama ang anumang detalye ng aking kalusugan maliban sa isinulat ko, at puwede kong bawiin ang pahintulot na ito anumang oras
              sa pamamagitan ng pag-message sa clinic.
            </span>
          </label>
          <fieldset className="space-y-1 pl-6">
            <legend className="muted text-xs">Kung pumayag, paano ako papangalanan:</legend>
            {DISPLAY_NAME_OPTIONS.map((o) => (
              <label key={o.key} className="flex items-center gap-2">
                <input type="radio" name="displayName" value={o.key} defaultChecked={o.key === "INITIAL"} /> {o.label}
              </label>
            ))}
          </fieldset>
        </div>
        <button className="btn w-full">Ipadala</button>
        <p className="muted text-center text-xs"><a href="/privacy" className="underline">Privacy notice</a></p>
      </form>
    </main>
  );
}
