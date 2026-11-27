"use client";

import { useEffect, useRef, useState } from "react";

// Voice typing with the browser's own speech recognition (Chrome, Edge, Safari). The spoken words are added to the
// text box so the user can check and fix them before sending. Hidden on browsers that don't support it.

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const LANGS = [
  { code: "fil-PH", label: "Tagalog" },
  { code: "en-PH", label: "English" },
];

export function MicButton({ value, onChange, disabled }: { value: string; onChange: (text: string) => void; disabled?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState("fil-PH");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const base = useRef("");

  useEffect(() => {
    setSupported(Boolean(recognitionClass()));
    try {
      const saved = localStorage.getItem("micLang");
      if (saved && LANGS.some((l) => l.code === saved)) setLang(saved);
    } catch {}
    return () => rec.current?.stop();
  }, []);

  // Sending the message (the box becomes disabled) ends the dictation, so the next words don't land in the old text.
  useEffect(() => {
    if (disabled && rec.current) {
      rec.current.onresult = null;
      rec.current.stop();
      setListening(false);
    }
  }, [disabled]);

  if (!supported) return null;

  function start() {
    const Rec = recognitionClass();
    if (!Rec) return;
    setError(null);
    const r = new Rec();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    base.current = value.trim() ? `${value.trim()} ` : "";
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      onChange((base.current + finalText + interim).replace(/\s+/g, " ").trimStart());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Payagan ang mikropono sa browser (icon sa address bar).");
      else if (e.error === "no-speech") setError("Walang narinig. Subukan ulit.");
      else if (e.error !== "aborted") setError("Hindi gumana ang voice. Subukan ulit o i-type na lang.");
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }

  function stop() {
    rec.current?.stop();
    setListening(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={listening ? "btn-danger" : "btn-secondary"}
        onClick={listening ? stop : start}
        disabled={disabled}
        title={listening ? "Itigil ang pakikinig" : "Magsalita sa halip na mag-type"}
        aria-label={listening ? "Itigil ang voice" : "Voice"}
      >
        {listening ? (<><span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden="true" /> Nakikinig… pindutin para tumigil</>) : "🎤 Magsalita"}
      </button>
      <select
        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
        value={lang}
        disabled={listening}
        onChange={(e) => {
          setLang(e.target.value);
          try {
            localStorage.setItem("micLang", e.target.value);
          } catch {}
        }}
        aria-label="Wika ng voice"
      >
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </div>
  );
}
