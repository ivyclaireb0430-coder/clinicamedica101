"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveAiLesson, trainAiTurn, type TrainerTurnResult } from "../../actions";

type Lesson = { kind: "RULE" | "FACT"; text: string; saved?: boolean; skipped?: boolean };
type Line = { from: "owner" | "ai"; text: string; lessons?: Lesson[]; preview?: TrainerTurnResult["preview"] };

const STARTERS = [
  "Ano na ang alam mo tungkol sa clinic?",
  "Tanungin mo ako ng mga kulang mong impormasyon",
  "Paano mo sasagutin ang 'magkano po?'",
  "Paano mo sasagutin ang 'may diabetes po ako, matutulungan nyo ba ako?'",
  "Gusto ko mas maikli at mas friendly ang mga sagot mo",
];

export function TrainerChat() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send(message: string) {
    const msg = message.trim();
    if (!msg) return;
    setError(null);
    const next: Line[] = [...lines, { from: "owner", text: msg }];
    setLines(next);
    setText("");
    start(async () => {
      // The AI's test previews are shown in the chat too, so the trainer knows what it answered.
      const history = next.map((l) => ({
        from: l.from,
        text: l.preview?.reply ? `${l.text}\n[Your reply to the patient: ${l.preview.reply}]` : l.text,
      }));
      const r = await trainAiTurn({ history });
      if (r.error) {
        setError(r.error);
        return;
      }
      setLines((cur) => [...cur, { from: "ai", text: r.reply ?? "", lessons: r.lessons, preview: r.preview }]);
    });
  }

  function remember(lineIdx: number, lessonIdx: number, skip = false) {
    const lesson = lines[lineIdx]?.lessons?.[lessonIdx];
    if (!lesson) return;
    const mark = (patch: Partial<Lesson>) =>
      setLines((cur) => cur.map((l, i) => (i !== lineIdx ? l : { ...l, lessons: l.lessons?.map((x, j) => (j === lessonIdx ? { ...x, ...patch } : x)) })));
    if (skip) return mark({ skipped: true });
    start(async () => {
      const r = await saveAiLesson({ kind: lesson.kind, text: lesson.text });
      if (r.error) return setError(r.error);
      mark({ saved: true });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="max-h-[65vh] space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
        {lines.length === 0 && (
          <p className="muted">
            Kausapin ang AI na parang bagong staff. Sabihin ang gusto ninyong tandaan nito, halimbawa: &quot;Tumatanggap kami ng GCash at cash&quot; o
            &quot;Huwag mong ibigay agad ang presyo, tanungin muna kung ano ang concern&quot;.
          </p>
        )}
        {lines.map((l, i) => (
          <div key={i} className="space-y-1">
            <div className={l.from === "owner" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${l.from === "owner" ? "bg-emerald-700 text-white" : "bg-white shadow-sm"}`}>{l.text}</div>
            </div>
            {l.preview && (
              <div className="ml-4 max-w-[85%] rounded-lg border border-sky-200 bg-sky-50 p-2">
                <p className="text-xs text-sky-800">Pasyente: &quot;{l.preview.patientMessage}&quot;</p>
                {l.preview.reply && <p className="mt-1 whitespace-pre-wrap">{l.preview.reply}</p>}
                {l.preview.note && <p className="mt-1 text-xs text-amber-700">⚙ {l.preview.note}</p>}
                <p className="mt-1 text-[11px] text-slate-500">Ganito ang sasabihin ng AI sa Messenger. Kung may gusto kayong baguhin, sabihin lang.</p>
              </div>
            )}
            {l.lessons?.map((x, j) => (
              <div key={j} className="ml-4 flex max-w-[85%] flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                <span className="rounded bg-white px-1.5 text-[11px] text-emerald-800">{x.kind === "FACT" ? "Impormasyon" : "Paraan ng pagsagot"}</span>
                <span className={`flex-1 ${x.skipped ? "text-slate-400 line-through" : ""}`}>{x.text}</span>
                {x.saved ? (
                  <span className="text-emerald-700">✓ Natandaan</span>
                ) : x.skipped ? null : (
                  <>
                    <button type="button" className="btn" disabled={pending} onClick={() => remember(i, j)}>Tandaan</button>
                    <button type="button" className="btn-secondary" disabled={pending} onClick={() => remember(i, j, true)}>Huwag</button>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
        {pending && <p className="muted">Nag-iisip…</p>}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <textarea
          className="input flex-1"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          placeholder="Turuan ang AI o magtanong…"
          maxLength={2000}
          disabled={pending}
        />
        <button className="btn" disabled={pending || !text.trim()}>Send</button>
      </form>
      <div className="flex flex-wrap gap-1">
        {STARTERS.map((s) => (
          <button key={s} type="button" disabled={pending} className="rounded-full border border-slate-200 px-2 py-0.5 text-xs" onClick={() => send(s)}>
            {s}
          </button>
        ))}
        {lines.length > 0 && (
          <button type="button" className="rounded-full border border-slate-200 px-2 py-0.5 text-xs" onClick={() => { setLines([]); setError(null); }}>
            Bagong usapan
          </button>
        )}
      </div>
      {error && <p className="rounded bg-red-50 p-2 text-red-700">{error}</p>}
    </div>
  );
}
