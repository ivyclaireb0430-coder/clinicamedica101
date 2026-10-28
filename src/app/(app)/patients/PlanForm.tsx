"use client";

import { useState } from "react";

type Item = { modality: string; sessions: number; unitPricePhp: number; notes: string | null };
type Values = Partial<Record<"title" | "goals" | "schedule" | "benefits" | "risks" | "alternatives", string | null>>;

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

export function PlanForm({ action, values = {}, items: initial = [] }: { action: (fd: FormData) => Promise<void>; values?: Values; items?: Item[] }) {
  const [items, setItems] = useState<Item[]>(initial.length ? initial : [{ modality: "", sessions: 1, unitPricePhp: 0, notes: "" }]);
  const update = (i: number, patch: Partial<Item>) => setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const total = items.reduce((s, i) => s + (i.sessions || 0) * (i.unitPricePhp || 0), 0);
  const area = (name: keyof Values, label: string, hint: string) => (
    <div className="md:col-span-2">
      <label className="label" htmlFor={name}>{label}</label>
      <textarea className="input" id={name} name={name} rows={3} placeholder={hint} defaultValue={values[name] ?? ""} />
    </div>
  );

  return (
    <form action={action} className="card grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="label" htmlFor="title">Plan name</label>
        <input className="input" id="title" name="title" defaultValue={values.title ?? ""} placeholder="e.g. Initial plan – Nov 2026 (no diagnosis here; it prints on the patient copy)" />
      </div>
      {area("goals", "Goals of treatment", "What this plan aims to address, in plain words")}

      <div className="space-y-2 md:col-span-2">
        <div className="label">Modalities, sessions & cost</div>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-6 gap-2 rounded-lg border border-slate-200 p-2">
            <input className="input col-span-6 sm:col-span-3" name="modality" placeholder="Modality" value={it.modality} onChange={(e) => update(i, { modality: e.target.value })} />
            <input className="input col-span-2 sm:col-span-1" name="sessions" type="number" min={1} title="Sessions" value={it.sessions} onChange={(e) => update(i, { sessions: Number(e.target.value) })} />
            <input className="input col-span-3 sm:col-span-1" name="unitPricePhp" type="number" min={0} title="Price per session (₱)" value={it.unitPricePhp} onChange={(e) => update(i, { unitPricePhp: Number(e.target.value) })} />
            <button type="button" className="col-span-1 text-sm text-red-600" onClick={() => setItems(items.filter((_, k) => k !== i))} aria-label="Remove">✕</button>
            <input className="input col-span-6" name="itemNotes" placeholder="Notes (optional)" value={it.notes ?? ""} onChange={(e) => update(i, { notes: e.target.value })} />
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button type="button" className="btn-secondary" onClick={() => setItems([...items, { modality: "", sessions: 1, unitPricePhp: 0, notes: "" }])}>
            + Add modality
          </button>
          <span className="font-semibold">Estimated total: {peso.format(total)}</span>
        </div>
        <p className="muted text-xs">Sessions × price per session. Columns: modality · sessions · ₱ per session.</p>
      </div>

      {area("schedule", "Schedule", "e.g. Once a week for 8 weeks, reassess at week 4")}
      {area("benefits", "Potential benefits", "Realistic, no guaranteed outcomes")}
      {area("risks", "Risks & possible side effects", "Discussed with the patient")}
      {area("alternatives", "Alternatives discussed", "Including the option of no treatment")}
      <div className="md:col-span-2">
        <button className="btn w-full sm:w-auto">Save plan</button>
      </div>
    </form>
  );
}
