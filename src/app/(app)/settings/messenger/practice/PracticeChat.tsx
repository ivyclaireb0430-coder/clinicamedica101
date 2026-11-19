"use client";

import { useState, useTransition } from "react";
import { practiceChatTurn } from "../../actions";
import type { SimSession } from "@/lib/messenger/simulator";

const EMPTY: SimSession = { lines: [], state: JSON.stringify({ step: "IDLE" }) };

const SAMPLES = [
  "Hi po",
  "Interested po",
  "Magkano po ang vector scan?",
  "May CKD po ako, makakatulong ba kayo?",
  "Saan po kayo?",
  "Pwede po bukas?",
  "Tumatanggap po ba kayo ng HMO?",
  "Ano pong gamot sa high blood?",
];

type Note = { at: number; text: string };

export function PracticeChat({ aiReady }: { aiReady: boolean }) {
  const [session, setSession] = useState<SimSession>(EMPTY);
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [useAi, setUseAi] = useState(aiReady);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send(input: { text?: string; payload?: string }) {
    setError(null);
    start(async () => {
      const r = await practiceChatTurn({ session, ...input, useAi });
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      if ("session" in r && r.session) {
        const at = r.session.lines.length;
        setSession(r.session);
        setNotes((n) => [...n, ...(r.notes ?? []).map((t) => ({ at, text: t }))]);
        setText("");
      }
    });
  }

  const last = session.lines.at(-1);
  const buttons = last?.from === "bot" ? last.quickReplies ?? [] : [];

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={useAi} disabled={!aiReady} onChange={(e) => setUseAi(e.target.checked)} /> Gamitin ang AI
          {!aiReady && <span className="muted">(wala pang API key)</span>}
        </label>
        <button type="button" className="btn-secondary" onClick={() => { setSession(EMPTY); setNotes([]); setError(null); }}>
          Bagong usapan
        </button>
      </div>

      <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
        {session.lines.length === 0 && <p className="muted">Magsimula na parang bagong pasyente galing sa ad. Halimbawa: &quot;Hi po&quot;.</p>}
        {session.lines.map((l, i) => (
          <div key={i}>
            <div className={l.from === "patient" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${l.from === "patient" ? "bg-emerald-700 text-white" : "bg-white shadow-sm"}`}>
                {l.text}
                {l.from === "bot" && <div className="mt-1 text-[11px] text-slate-400">{l.byAi ? "AI reply" : "Bot script"}</div>}
              </div>
            </div>
            {notes.filter((n) => n.at === i + 1).map((n, j) => (
              <p key={j} className="mt-1 text-center text-xs text-amber-700">⚙ {n.text}</p>
            ))}
          </div>
        ))}
        {pending && <p className="muted">Sumusulat…</p>}
      </div>

      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {buttons.map((b) => (
            <button key={b.payload} type="button" disabled={pending} className="rounded-full border border-emerald-600 px-3 py-1 text-emerald-700" onClick={() => send({ payload: b.payload })}>
              {b.title}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send({ text });
        }}
      >
        <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Mag-type bilang pasyente…" maxLength={600} disabled={pending} />
        <button className="btn" disabled={pending || !text.trim()}>Send</button>
      </form>
      <div className="flex flex-wrap gap-1">
        {SAMPLES.map((s) => (
          <button key={s} type="button" className="rounded-full border border-slate-200 px-2 py-0.5 text-xs" onClick={() => setText(s)}>
            {s}
          </button>
        ))}
      </div>
      {error && <p className="rounded bg-red-50 p-2 text-red-700">{error}</p>}
    </div>
  );
}
