"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; score: number };

const shortDate = (d: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** Single-series 0–10 trend of the main complaint. The entries list below it is the table view. */
export function ProgressChart({ points }: { points: Point[] }) {
  if (points.length < 2) return <p className="muted text-sm">Kailangan ng hindi bababa sa 2 rating para makita ang trend.</p>;
  return (
    <div className="h-56 w-full" role="img" aria-label={`Progress scores from ${points[0].score} to ${points[points.length - 1].score} out of 10`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} minTickGap={16} />
          <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
            formatter={(v) => [`${v} / 10`, "Score"]}
            labelFormatter={(d) => shortDate(String(d))}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
          />
          <Line type="monotone" dataKey="score" stroke="#24745e" strokeWidth={2} dot={{ r: 4, fill: "#24745e", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
