"use client";

import { useState } from "react";
import { renderScript } from "@/lib/scripts";

type Script = { id: string; title: string; body: string };

export function ScriptPicker({ scripts, values }: { scripts: Script[]; values: Record<string, string> }) {
  const [selected, setSelected] = useState(scripts[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const script = scripts.find((s) => s.id === selected);
  const text = script ? renderScript(script.body, values) : "";

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (scripts.length === 0) return <p className="muted">No scripts yet.</p>;
  return (
    <div className="space-y-2">
      <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
        {scripts.map((s) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>
      <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{text}</p>
      <button type="button" onClick={copy} className="btn-secondary w-full sm:w-auto">
        {copied ? "Copied ✓" : "Copy message"}
      </button>
    </div>
  );
}
