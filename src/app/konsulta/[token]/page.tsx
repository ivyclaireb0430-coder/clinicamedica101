import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { decrypt, decryptOptional } from "@/lib/crypto";
import { formatDateTime } from "@/lib/time";
import { consultCookieName, consultCookieValid, consultDoctorName, readPrescription } from "@/lib/consult/store";
import { verifyConsultMobile } from "../actions";
import { KonsultaShell } from "../Shell";
import { ConsultChat, type ChatLine } from "./ConsultChat";

export const metadata = { title: "Online konsulta · Clinica Medica 101", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function KonsultaSessionPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const session = await db.consultSession.findUnique({ where: { token }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!session) {
    return (
      <KonsultaShell>
        <div className="card space-y-2 text-center">
          <h1 className="text-xl font-bold">Hindi makita ang konsultang ito</h1>
          <p className="text-sm">Paki-check po ang link, o <Link className="text-brand-700 underline" href="/konsulta">magsimula ng bago</Link>.</p>
        </div>
      </KonsultaShell>
    );
  }
  const doctor = await consultDoctorName();

  // A leaked or forwarded link alone is not enough: this browser must have started the consult or know the mobile number.
  if (!consultCookieValid(session.id, (await cookies()).get(consultCookieName(session.id))?.value)) {
    return (
      <KonsultaShell>
        <form action={verifyConsultMobile.bind(null, token)} className="card space-y-3">
          <h1 className="text-xl font-bold">Online konsulta</h1>
          <p className="text-sm">Para sa inyong privacy, i-type po ang mobile number na ginamit ninyo sa konsultang ito.</p>
          {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">Hindi po tugma ang mobile number.</p>}
          <input className="input" name="mobile" type="tel" required placeholder="0917 123 4567" autoComplete="tel" />
          <button className="btn w-full">Buksan</button>
        </form>
      </KonsultaShell>
    );
  }

  const lines: ChatLine[] = session.messages.map((m) => ({
    from: m.sender === "PATIENT" ? "patient" : m.sender === "SYSTEM" ? "system" : m.sender === "DOCTOR" ? "doctor" : "ai",
    text: decrypt(m.textEnc),
  }));
  const header = (
    <div className="card mb-3 flex items-center gap-3 p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-sky-500 text-xl text-white" aria-hidden="true">🤖</span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{doctor} AI</p>
        <p className="text-xs text-slate-500">Sinanay ni Doc mismo. Si {doctor} ang magbabasa ng usapan at magbibigay ng reseta.</p>
      </div>
    </div>
  );

  if (session.status === "ACTIVE") {
    return (
      <KonsultaShell>
        {header}
        <ConsultChat token={token} doctor={doctor} initial={lines} />
      </KonsultaShell>
    );
  }

  const rx = session.status === "SENT" ? readPrescription(session) : [];
  const note = session.status === "SENT" ? decryptOptional(session.doctorNoteEnc) : null;
  return (
    <KonsultaShell>
      {session.status === "EMERGENCY" && (
        <div className="card mb-3 space-y-2 border-red-300 bg-red-50 text-red-900">
          <h1 className="text-lg font-bold">🚑 Pumunta po agad sa pinakamalapit na ER o tumawag sa 911</h1>
          <p className="text-sm">Hindi na po itutuloy ng AI assistant ang konsultang ito. Naabisuhan na si {doctor}.</p>
          <p className="text-sm">Crisis hotline (NCMH): 1553, 0917 899 8727, 0966 351 4518 (24 oras).</p>
        </div>
      )}
      {session.status === "SUBMITTED" && (
        <div className="card mb-3 space-y-1 text-center">
          <h1 className="text-lg font-bold">Naipadala na po kay {doctor} ✅</h1>
          <p className="text-sm">Babasahin niya ang inyong konsulta. Makakatanggap kayo ng text o email kapag may sagot na siya. Puwede nang isara ang page na ito.</p>
          <p className="text-xs text-slate-500">Kung lumala ang nararamdaman o may emergency, pumunta agad sa ER o tumawag sa 911.</p>
        </div>
      )}
      {session.status === "SENT" && (
        <div className="card mb-3 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-brand-700">Sagot ni {doctor}</p>
            {session.sentAt && <p className="text-xs text-slate-500">{formatDateTime(session.sentAt)}</p>}
          </div>
          {note && <p className="whitespace-pre-wrap text-sm">{note}</p>}
          {rx.length > 0 && (
            <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3">
              <p className="mb-1 font-semibold">℞ e-Reseta</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {rx.map((r, i) => (
                  <li key={i}>
                    <b>{r.drug}</b> {r.form} {r.qty && <>· #{r.qty}</>}
                    <br />
                    <span className="text-slate-700">Sig: {r.sig}</span>
                  </li>
                ))}
              </ol>
              <Link href={`/konsulta/${token}/reseta`} className="btn mt-2 w-full">Buksan / i-print ang e-Reseta</Link>
            </div>
          )}
          <p className="text-xs text-slate-500">Kung lumala ang nararamdaman, pumunta sa ER o tumawag sa 911. May tanong? Mag-message sa clinic.</p>
        </div>
      )}
      {session.status === "CLOSED" && (
        <div className="card mb-3 text-center text-sm">Sarado na po ang konsultang ito. <Link className="text-brand-700 underline" href="/konsulta">Magsimula ng bago</Link></div>
      )}
      <details className="card text-sm" open={session.status === "EMERGENCY"}>
        <summary className="cursor-pointer font-semibold">Ang inyong usapan</summary>
        <div className="mt-2 space-y-2">
          {lines.map((l, i) => (
            <p key={i} className={l.from === "patient" ? "text-right" : ""}>
              <span className="text-xs text-slate-500">{l.from === "patient" ? "Kayo" : l.from === "system" ? "Paalala" : l.from === "doctor" ? doctor : "AI assistant"}: </span>
              <span className="whitespace-pre-wrap">{l.text}</span>
            </p>
          ))}
        </div>
      </details>
    </KonsultaShell>
  );
}
