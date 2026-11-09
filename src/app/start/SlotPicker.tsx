"use client";

import { useState } from "react";

type Day = { date: string; slots: string[] };

const TZ = "Asia/Manila";

/** Day chips + time chips. Submits the chosen slot as `slotStart` (ISO), or "" for "call me instead". */
export function SlotPicker({
  days, labels,
}: {
  days: Day[];
  lang?: "tl" | "en";
  labels: { title: string; help: string; callMe: string; none: string };
}) {
  // Dates are always in English (owner's choice), even on the Taglish pages.
  const dayFmt = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: TZ });
  const timeFmt = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  const [day, setDay] = useState(days[0]?.date ?? "");
  const [slot, setSlot] = useState<string>("");
  const current = days.find((d) => d.date === day);

  return (
    <fieldset className="min-w-0 rounded-2xl border-2 border-cm-blue/20 bg-cm-sky/60 p-3 sm:p-4">
      <legend className="px-1 text-base font-bold text-cm-navy">{labels.title}</legend>
      <p className="mb-3 text-xs text-slate-600">{labels.help}</p>
      <input type="hidden" name="slotStart" value={slot} />
      {days.length === 0 ? (
        <p className="text-sm text-slate-600">{labels.none}</p>
      ) : (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist">
            {days.map((d) => {
              const active = d.date === day;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setDay(d.date)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    active ? "border-cm-blue bg-cm-blue text-white" : "border-slate-200 bg-white text-cm-navy hover:border-cm-blue"
                  }`}
                >
                  {dayFmt.format(new Date(`${d.date}T04:00:00Z`))}
                </button>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {current?.slots.map((s) => {
              const active = s === slot;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSlot(active ? "" : s)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                    active ? "border-cm-red bg-cm-red text-white shadow" : "border-slate-200 bg-white text-slate-800 hover:border-cm-red"
                  }`}
                >
                  {timeFmt.format(new Date(s))}
                </button>
              );
            })}
          </div>
        </>
      )}
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={slot === ""} onChange={(e) => e.target.checked && setSlot("")} className="h-4 w-4 accent-cm-blue" />
        {labels.callMe}
      </label>
      {slot && (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-cm-red">
          ✓ {dayFmt.format(new Date(slot))}, {timeFmt.format(new Date(slot))}
        </p>
      )}
    </fieldset>
  );
}
