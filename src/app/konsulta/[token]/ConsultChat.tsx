"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { sendConsultMessage, submitConsultToDoctor, uploadConsultFile } from "../actions";

export type ChatLine = { from: "patient" | "ai" | "system" | "doctor"; text: string };

export function ConsultChat({ token, doctor, initial }: { token: string; doctor: string; initial: ChatLine[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<ChatLine[]>(initial);
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const patientCount = lines.filter((l) => l.from === "patient").length;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length, pending]);

  function send() {
    const msg = text.trim();
    if (!msg || pending) return;
    setError(null);
    setText("");
    setLines((cur) => [...cur, { from: "patient", text: msg }]);
    start(async () => {
      const r = await sendConsultMessage(token, msg);
      if (r.error) return setError(r.error);
      if (r.emergency) return router.refresh();
      setLines((cur) => [...cur, { from: "ai", text: r.reply ?? "" }]);
      if (r.readyForDoctor) setReady(true);
    });
  }

  function upload(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const r = await uploadConsultFile(token, fd);
      if (r.error) return setError(r.error);
      setLines((cur) => [...cur, { from: "patient", text: `📎 ${r.name}` }]);
    });
  }

  function submit() {
    start(async () => {
      const r = await submitConsultToDoctor(token);
      if (r.error) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-3 p-3">
        {lines.map((l, i) => (
          <div key={i} className={l.from === "patient" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[15px] leading-snug ${
                l.from === "patient" ? "bg-brand-600 text-white" : l.from === "system" ? "border border-red-200 bg-red-50 text-red-900" : l.from === "doctor" ? "border border-emerald-200 bg-emerald-50 text-emerald-950" : "bg-slate-100 text-slate-900"
              }`}
            >
              {l.from === "doctor" && <span className="mb-0.5 block text-xs font-semibold text-emerald-700">{doctor} (tanong ni Doc)</span>}
              {l.text}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500">Nagta-type…</div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <button
          type="button"
          className="btn-secondary h-11 w-11 shrink-0 px-0 text-lg"
          title="Mag-attach ng picture o lab result"
          aria-label="Mag-attach ng picture o lab result"
          disabled={pending}
          onClick={() => fileInput.current?.click()}
        >
          📎
        </button>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <textarea
          className="input min-h-11 flex-1"
          rows={2}
          value={text}
          maxLength={2000}
          placeholder="I-type ang inyong sagot…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn h-11 shrink-0" disabled={pending || !text.trim()}>Send</button>
      </form>

      {patientCount > 0 && (
        <div className={`card space-y-2 p-3 text-sm ${ready ? "ring-2 ring-brand-400" : ""}`}>
          {!confirming ? (
            <>
              <p>{ready ? `Handa na po itong ipadala kay ${doctor}.` : `Kapag tapos na kayong magkuwento, ipadala na po ito kay ${doctor}.`}</p>
              <button type="button" className={ready ? "btn w-full py-3 text-base" : "btn-secondary w-full"} disabled={pending} onClick={() => setConfirming(true)}>
                Ipadala kay Doc
              </button>
            </>
          ) : (
            <>
              <p>Ipadala na po ba? Hindi na po kayo makakapagdagdag sa usapang ito pagkatapos.</p>
              <div className="flex gap-2">
                <button type="button" className="btn flex-1" disabled={pending} onClick={submit}>Oo, ipadala</button>
                <button type="button" className="btn-secondary flex-1" disabled={pending} onClick={() => setConfirming(false)}>Hindi pa</button>
              </div>
            </>
          )}
        </div>
      )}
      <p className="text-center text-xs text-slate-500">🚑 Emergency? Pumunta agad sa ER o tumawag sa 911.</p>
    </div>
  );
}
