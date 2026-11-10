"use client";

import { useEffect, useRef, useState } from "react";

type Day = { date: string; slots: string[] };

const TZ = "Asia/Manila";
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" → midnight UTC of that calendar day (only used for calendar arithmetic). */
const utc = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Calendar weeks (Sunday first) covering the first to the last bookable day; null = padding before/after the range. */
export function calendarWeeks(dates: string[]): (string | null)[][] {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const first = utc(sorted[0]);
  const last = utc(sorted[sorted.length - 1]);
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  for (let t = first.getTime(); t <= last.getTime(); t += DAY_MS) cells.push(ymd(new Date(t)));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * A calendar of open days, then the open times of the chosen day. Submits the chosen slot as `slotStart` (ISO).
 * A date and time are required unless the visitor ticks "call me instead" (then `callMe=1` and a preferred time).
 */
export function SlotPicker({
  days, labels, times,
}: {
  days: Day[];
  lang?: "tl" | "en";
  labels: { title: string; help: string; callMe: string; none: string; when: string; required: string; chosen: string };
  times: { key: string; label: string }[];
}) {
  const dayFmt = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: TZ });
  const monthFmt = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
  const timeFmt = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  const open = new Map(days.map((d) => [d.date, d.slots]));
  const [day, setDay] = useState(days[0]?.date ?? "");
  const [slot, setSlot] = useState("");
  const [callMe, setCallMe] = useState(days.length === 0);
  const slotInput = useRef<HTMLInputElement>(null);
  // The browser's "please pick" message must be cleared once a time is picked, or the form stays blocked.
  useEffect(() => slotInput.current?.setCustomValidity(""), [slot, callMe]);
  const weeks = calendarWeeks(days.map((d) => d.date));
  const months = [...new Set(weeks.flat().filter(Boolean).map((d) => monthFmt.format(utc(d!))))];
  const slots = open.get(day) ?? [];

  return (
    <fieldset className="relative min-w-0 rounded-2xl border-2 border-cm-blue/20 bg-cm-sky/60 p-3 sm:p-4">
      <legend className="px-1 text-base font-bold text-cm-navy">{labels.title}</legend>
      <input type="hidden" name="callMe" value={callMe ? "1" : ""} />
      {days.length === 0 ? (
        <p className="text-sm text-slate-600">{labels.none}</p>
      ) : (
        <div className={callMe ? "pointer-events-none opacity-40" : ""} aria-disabled={callMe}>
          <p className="mb-3 text-xs text-slate-600">{labels.help}</p>
          {/* Required unless "call me" is ticked, so the browser asks for a date and time before sending. */}
          <input
            ref={slotInput}
            name="slotStart"
            value={slot}
            onChange={() => undefined}
            required={!callMe}
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none absolute h-px w-px opacity-0"
            onInvalid={(e) => e.currentTarget.setCustomValidity(labels.required)}
          />
          <div className="rounded-xl bg-white p-2 sm:p-3">
            <p className="mb-2 text-center text-sm font-bold text-cm-navy">{months.join(" – ")}</p>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEK.map((w) => <div key={w} className="pb-1 text-[11px] font-semibold uppercase text-slate-400">{w}</div>)}
              {weeks.flat().map((d, i) => {
                if (!d) return <div key={`pad-${i}`} />;
                const available = open.has(d);
                const active = d === day;
                const n = utc(d).getUTCDate();
                const label = n === 1 ? `${monthFmt.format(utc(d)).slice(0, 3)} 1` : String(n);
                return available ? (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={active}
                    aria-label={dayFmt.format(new Date(`${d}T04:00:00Z`))}
                    onClick={() => { setDay(d); setSlot(""); }}
                    className={`aspect-square rounded-lg text-sm font-semibold transition ${
                      active ? "bg-cm-blue text-white shadow" : "bg-cm-sky text-cm-navy hover:bg-cm-blue/20"
                    }`}
                  >
                    {label}
                  </button>
                ) : (
                  <div key={d} className="flex aspect-square items-center justify-center text-sm text-slate-300 line-through" title="Closed / full">{label}</div>
                );
              })}
            </div>
          </div>
          {day && (
            <>
              <p className="mt-3 text-sm font-semibold text-cm-navy">{dayFmt.format(new Date(`${day}T04:00:00Z`))}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => {
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
          {slot && (
            <p className="mt-3 rounded-lg border-2 border-cm-red/30 bg-white px-3 py-2 text-sm text-slate-700">
              {labels.chosen}<br />
              <span className="text-base font-bold text-cm-red">📅 {dayFmt.format(new Date(slot))}, {timeFmt.format(new Date(slot))}</span>
            </p>
          )}
        </div>
      )}
      {days.length > 0 && (
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={callMe} onChange={(e) => { setCallMe(e.target.checked); if (e.target.checked) setSlot(""); }} className="h-4 w-4 accent-cm-blue" />
          {labels.callMe}
        </label>
      )}
      {callMe && (
        <label className="mt-3 block"><span className="label">{labels.when}</span>
          <select className="input" name="preferredTime" defaultValue="ANY">
            {times.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      )}
    </fieldset>
  );
}
