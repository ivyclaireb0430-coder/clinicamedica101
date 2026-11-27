import Link from "next/link";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { verifyBookingToken } from "@/lib/messenger/booking-link";
import { consultDoctorName, consultOpen } from "@/lib/consult/store";
import { startConsult } from "./actions";
import { KonsultaShell } from "./Shell";

export const metadata = { title: "Online konsulta · Clinica Medica 101", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function KonsultaStartPage({ searchParams }: { searchParams: Promise<{ error?: string; m?: string }> }) {
  const { error, m } = await searchParams;
  const [open, doctor, feeNote, phone] = await Promise.all([consultOpen(), consultDoctorName(), getSetting("consultFeeNote"), getSetting("clinicPhone")]);

  if (!open) {
    return (
      <KonsultaShell>
        <div className="card space-y-2 text-center">
          <h1 className="text-xl font-bold">Hindi pa bukas ang online konsulta</h1>
          <p className="text-sm">
            Puwede po kayong mag-book ng consultation sa clinic. <Link className="text-brand-700 underline" href="/start">Mag-book dito</Link>
            {phone ? ` o tumawag sa ${phone}` : ""}.
          </p>
        </div>
      </KonsultaShell>
    );
  }

  // From Messenger: prefill the name and mobile we already have.
  const conversationId = m ? verifyBookingToken(m) : null;
  const lead = conversationId ? (await db.conversation.findUnique({ where: { id: conversationId }, include: { lead: true } }))?.lead : null;

  return (
    <KonsultaShell>
      <div className="card mb-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-sky-500 text-2xl text-white" aria-hidden="true">🩺</span>
          <div>
            <h1 className="text-xl font-bold leading-tight">Online konsulta</h1>
            <p className="text-sm text-slate-600">kasama ang {doctor} AI, sinanay ni Doc mismo</p>
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <b>Paalala:</b> Ang kakausap sa inyo ay ang <b>{doctor} AI</b>, sinanay ni Doc para magtanong at magsalita tulad niya. Pagkatapos,
          babasahin ni {doctor} mismo ang buong usapan, at <b>siya ang magbibigay ng assessment at reseta</b> kung kailangan.
        </div>
        <ol className="space-y-1 text-sm">
          <li>1. Ikuwento sa AI assistant ang inyong concern. Puwedeng mag-attach ng picture o lab result.</li>
          <li>2. Pindutin ang <b>Ipadala kay Doc</b>.</li>
          <li>3. Makakatanggap kayo ng text o email kapag nakasagot na si {doctor}.</li>
        </ol>
        {feeNote && <p className="rounded-lg bg-sky-50 p-2 text-sm text-sky-900">{feeNote}</p>}
        <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800">
          🚑 <b>Emergency?</b> (hirap huminga, sakit sa dibdib, nahimatay, matinding pagdurugo, iniisip saktan ang sarili) Huwag na pong mag-online:
          pumunta agad sa pinakamalapit na ER o tumawag sa <b>911</b>.
        </p>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <form action={startConsult} className="card space-y-3">
        <h2 className="font-semibold">Tungkol sa inyo</h2>
        {m && <input type="hidden" name="m" value={m} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="firstName">First name *</label>
            <input className="input" id="firstName" name="firstName" required maxLength={60} defaultValue={lead && lead.firstName !== "Messenger user" ? lead.firstName : ""} />
          </div>
          <div>
            <label className="label" htmlFor="lastName">Last name</label>
            <input className="input" id="lastName" name="lastName" maxLength={60} defaultValue={lead?.lastName ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="birthDate">Birthday *</label>
            <input className="input" id="birthDate" name="birthDate" type="date" required />
          </div>
          <div>
            <label className="label" htmlFor="sex">Sex *</label>
            <select className="input" id="sex" name="sex" required defaultValue="">
              <option value="" disabled>Pumili…</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
              <option value="UNDISCLOSED">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="mobile">Mobile *</label>
            <input className="input" id="mobile" name="mobile" type="tel" required placeholder="0917 123 4567" defaultValue={lead?.mobile ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" defaultValue={lead?.email ?? ""} />
          </div>
        </div>

        <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-semibold">Pahintulot (Data Privacy Act of 2012)</p>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="consentPrivacy" className="mt-1" required />
            <span>
              Pinapayagan ko ang Clinica Medica 101 na kolektahin at gamitin ang aking personal at health information para sa online konsulta na ito,
              ayon sa <Link href="/privacy" className="text-brand-700 underline" target="_blank">Privacy Notice</Link>. Naka-encrypt ito at si {doctor} at ang
              awtorisadong clinic staff lang ang makakabasa.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="consentAi" className="mt-1" required />
            <span>
              Naiintindihan ko na <b>AI assistant</b> ang kausap ko, hindi si {doctor}, at na ang aking mga sagot ay ipoproseso ng AI service provider ng clinic
              (Anthropic, sa labas ng Pilipinas) para lang sa konsultang ito. Ang assessment at reseta ay manggagaling lang kay {doctor}.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="consentEmergency" className="mt-1" required />
            <span>Naiintindihan ko na hindi ito para sa emergency. Sa emergency, pupunta ako sa ER o tatawag sa 911.</span>
          </label>
          <p className="text-xs text-slate-500">Puwede ninyong bawiin ang pahintulot at ipabura ang inyong data anumang oras sa pamamagitan ng pag-message sa clinic.</p>
        </div>

        <button className="btn w-full py-3 text-base">Simulan ang konsulta</button>
      </form>
    </KonsultaShell>
  );
}
