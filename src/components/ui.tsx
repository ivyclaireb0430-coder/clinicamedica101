import Link from "next/link";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1>{title}</h1>
        <div className="mt-1 flex h-1 w-16 overflow-hidden rounded-full print:hidden" aria-hidden="true">
          <span className="flex-1 bg-emerald-500" /><span className="flex-1 bg-sky-500" /><span className="flex-1 bg-violet-500" /><span className="flex-1 bg-amber-400" />
        </div>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="card text-center text-sm text-slate-500">{children}</div>;
}

const STAGE_COLORS: Record<string, string> = {
  NEW: "bg-sky-100 text-sky-800",
  REPLIED: "bg-indigo-100 text-indigo-800",
  FEE_EXPLAINED: "bg-violet-100 text-violet-800",
  BOOKED: "bg-amber-100 text-amber-800",
  ATTENDED: "bg-emerald-100 text-emerald-800",
  PLAN_ACCEPTED: "bg-green-100 text-green-800",
  FOLLOW_UP: "bg-teal-100 text-teal-800",
  LOST: "bg-slate-200 text-slate-600",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  NO_SHOW: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-200 text-slate-600",
  RESCHEDULED: "bg-slate-200 text-slate-600",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`badge ${STAGE_COLORS[status] ?? ""}`}>{label}</span>;
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-3 inline-block text-sm font-medium text-sky-700 hover:underline">
      ← {label}
    </Link>
  );
}
