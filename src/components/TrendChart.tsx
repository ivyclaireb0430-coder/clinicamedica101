"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { week: string; inquiries: number; attended: number };

// Validated categorical slots 1 and 2 (light surface).
const SERIES = [
  { key: "inquiries", label: "New inquiries", color: "#2a78d6" },
  { key: "attended", label: "Attended", color: "#eb6834" },
] as const;

const weekLabel = (d: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** Weekly new inquiries vs attended consultations. Same unit (people), one axis. */
export function TrendChart({ rows }: { rows: Row[] }) {
  const last = rows.length - 1;
  const endLabel = (color: string, name: string) =>
    function EndLabel(props: { x?: number | string; y?: number | string; index?: number; value?: number | string }) {
      if (props.index !== last) return <g />;
      return (
        <text x={Number(props.x) + 8} y={Number(props.y)} dy={4} fontSize={11} fill="#334155">
          <tspan fill={color}>●</tspan> {name} {props.value}
        </text>
      );
    };
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      <div className="h-56 w-full" role="img" aria-label="New inquiries and attended consultations per week, last 8 weeks">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 96, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="week" tickFormatter={weekLabel} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} minTickGap={12} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
              labelFormatter={(d) => `Week of ${weekLabel(String(d))}`}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
            />
            {SERIES.map((s) => (
              <Line
                key={s.key} name={s.label} dataKey={s.key} type="monotone" stroke={s.color} strokeWidth={2}
                dot={{ r: 4, fill: s.color, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false}
                label={endLabel(s.color, s.label === "New inquiries" ? "Inquiries" : "Attended")}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
