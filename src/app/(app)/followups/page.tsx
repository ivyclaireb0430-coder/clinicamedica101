import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { decryptOptional } from "@/lib/crypto";
import { getNumberSetting } from "@/lib/settings";
import { followUpKindLabel, followUpStatus, inactivePatients, stalledPlans } from "@/lib/followup";
import { addDays, formatDate, formatDateTime, todayManila } from "@/lib/time";
import { EmptyState, PageHeader } from "@/components/ui";
import { recallPatient, sendFollowUpNow, setFollowUpStatus, setTestimonialHidden } from "./actions";

const name = (p: { firstName: string; lastName: string | null }) => `${p.firstName} ${p.lastName ?? ""}`.trim();

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<{ tab?: string; sent?: string }> }) {
  const user = await requirePermission("booking:read");
  const sp = await searchParams;
  const canWrite = can(user.role, "booking:write");
  const canFeedback = can(user.role, "feedback:read");
  const tabs = [
    { key: "due", label: "Due & overdue" },
    { key: "missed", label: "Missed sessions" },
    { key: "inactive", label: "Recall list" },
    ...(canFeedback ? [{ key: "feedback", label: "Feedback" }] : []),
  ];
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? "due";
  const back = `/followups?tab=${tab}`;
  const today = todayManila();

  return (
    <>
      <PageHeader title="Follow-up" subtitle="Para walang pasyenteng nakakalimutan" />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <Link key={t.key} href={`/followups?tab=${t.key}`} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      {sp.sent && (
        <p className="mb-3 rounded-lg bg-slate-100 p-3 text-sm">
          {sp.sent === "failed" ? "Hindi naipadala: walang available na channel (Messenger 24h, email, o SMS)." : `Sent via ${sp.sent.toLowerCase().replace("_", " ")}.`}
        </p>
      )}
      {tab === "due" && <DueTab today={today} back={back} canWrite={canWrite} />}
      {tab === "missed" && <MissedTab back={back} canWrite={canWrite} />}
      {tab === "inactive" && <InactiveTab back={back} canWrite={canWrite} />}
      {tab === "feedback" && canFeedback && <FeedbackTab />}
    </>
  );
}

async function DueTab({ today, back, canWrite }: { today: string; back: string; canWrite: boolean }) {
  const rows = await db.followUp.findMany({
    where: { status: "OPEN", dueDate: { lte: addDays(today, 7) } },
    orderBy: { dueDate: "asc" },
    include: { patient: { include: { lead: { select: { id: true, appointments: { where: { status: { in: ["BOOKED", "CONFIRMED"] }, startAt: { gt: new Date() } }, take: 1, orderBy: { startAt: "asc" } } } } } } },
  });
  if (!rows.length) return <EmptyState>Walang follow-up na due ngayong linggo. 🎉</EmptyState>;
  return (
    <ul className="space-y-2">
      {rows.map((f) => {
        const booked = f.patient.lead?.appointments[0];
        return (
          <li key={f.id} className="card text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/patients/${f.patientId}?tab=followup`} className="font-medium text-brand-700 hover:underline">{name(f.patient)}</Link>
              <span className={`badge ${f.dueDate < today ? "bg-red-100 text-red-700" : f.dueDate === today ? "bg-amber-100 text-amber-800" : ""}`}>{followUpStatus(f, today)}</span>
            </div>
            <div className="muted">
              {f.dueDate} · {followUpKindLabel(f.kind)}{f.note ? ` · ${f.note}` : ""}
            </div>
            <div className="muted text-xs">
              {booked ? `Booked ${formatDateTime(booked.startAt)}` : "No booking yet"}
              {f.recallCount ? ` · ${f.recallCount} reminder(s), last via ${f.lastRecallChannel?.toLowerCase()}` : ""}
            </div>
            {canWrite && (
              <div className="mt-2 flex flex-wrap gap-2">
                {f.patient.lead && !booked && <Link href={`/calendar/new?leadId=${f.patient.lead.id}`} className="btn">Book</Link>}
                {!booked && <form action={sendFollowUpNow.bind(null, f.id, back)}><button className="btn-secondary">Send reminder</button></form>}
                <form action={setFollowUpStatus.bind(null, f.id, "DONE", back)}><button className="btn-secondary">Done</button></form>
                <form action={setFollowUpStatus.bind(null, f.id, "CANCELLED", back)}><button className="btn-secondary">Cancel</button></form>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

async function MissedTab({ back, canWrite }: { back: string; canWrite: boolean }) {
  const gap = await getNumberSetting("stalledPlanDays");
  const rows = await stalledPlans();
  return (
    <>
      <p className="muted mb-3 text-sm">Naka-start na treatment plan na walang session sa loob ng {gap} araw o higit pa, at walang booking.</p>
      {!rows.length && <EmptyState>Walang na-miss na session.</EmptyState>}
      <ul className="space-y-2">
        {rows.map(({ plan, lastVisit, days }) => (
          <li key={plan.id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <Link href={`/patients/${plan.patientId}?tab=followup`} className="font-medium text-brand-700 hover:underline">{name(plan.patient)}</Link>
              <div className="muted">Last visit {lastVisit} ({days} days ago){plan.recallSentAt ? ` · recall sent ${formatDate(plan.recallSentAt)}` : ""}</div>
            </div>
            {canWrite && <form action={recallPatient.bind(null, plan.patientId, "MISSED", back)}><button className="btn-secondary">Send reminder</button></form>}
          </li>
        ))}
      </ul>
    </>
  );
}

async function InactiveTab({ back, canWrite }: { back: string; canWrite: boolean }) {
  const days = await getNumberSetting("recallInactiveDays");
  const rows = await inactivePatients();
  return (
    <>
      <p className="muted mb-3 text-sm">Mga pasyenteng hindi bumisita sa loob ng {days} araw at walang booking. Babaguhin ang bilang ng araw sa Settings → Follow-up & billing.</p>
      {!rows.length && <EmptyState>Walang inactive na pasyente.</EmptyState>}
      <ul className="space-y-2">
        {rows.map(({ patient, lastVisit, days: d, recall }) => (
          <li key={patient.id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <Link href={`/patients/${patient.id}?tab=followup`} className="font-medium text-brand-700 hover:underline">{name(patient)}</Link>
              <div className="muted">Last visit {lastVisit} ({d} days ago){recall?.lastRecallAt ? ` · recall sent ${formatDate(recall.lastRecallAt)}` : ""}</div>
            </div>
            {canWrite && !recall && <form action={recallPatient.bind(null, patient.id, "INACTIVE", back)}><button className="btn-secondary">Send recall</button></form>}
          </li>
        ))}
      </ul>
    </>
  );
}

async function FeedbackTab() {
  const rows = await db.feedback.findMany({
    where: { submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
    take: 100,
    include: { patient: { select: { firstName: true, lastName: true } } },
  });
  const pending = await db.feedback.count({ where: { submittedAt: null, expiresAt: { gt: new Date() } } });
  const avg = rows.length ? rows.reduce((s, r) => s + (r.rating ?? 0), 0) / rows.length : 0;
  const testimonials = rows.filter((r) => r.testimonialConsent);
  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="card"><div className="muted">Average rating</div><div className="text-2xl font-semibold">{rows.length ? avg.toFixed(1) : "—"}<span className="text-base text-slate-400">/5</span></div></div>
        <div className="card"><div className="muted">Responses</div><div className="text-2xl font-semibold">{rows.length}</div></div>
        <div className="card"><div className="muted">Testimonial OK</div><div className="text-2xl font-semibold">{testimonials.length}</div></div>
      </div>
      <p className="muted mb-3 text-sm">
        {pending} request(s) waiting for an answer. Gamitin lang bilang testimonial ang may &quot;Consent ✓&quot;, gamit ang pangalang pinili ng pasyente, at walang pangakong resulta.
      </p>
      <ul className="space-y-2">
        {rows.map((f) => (
          <li key={f.id} className="card text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{"★".repeat(f.rating ?? 0)}<span className="text-slate-300">{"★".repeat(5 - (f.rating ?? 0))}</span></span>
              <span className="muted text-xs">{formatDate(f.submittedAt!)} · {name(f.patient)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap">{decryptOptional(f.commentEnc) ?? <span className="muted">No comment</span>}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {f.testimonialConsent ? (
                <>
                  <span className="badge bg-emerald-100 text-emerald-800">Consent ✓ · show as: {f.displayName}</span>
                  <form action={setTestimonialHidden.bind(null, f.id, !f.testimonialHidden)}>
                    <button className="btn-secondary">{f.testimonialHidden ? "Allow use again" : "Don't use"}</button>
                  </form>
                  {f.testimonialHidden && <span className="muted">Hidden from testimonials</span>}
                </>
              ) : (
                <span className="badge">No testimonial consent</span>
              )}
            </div>
          </li>
        ))}
        {!rows.length && <EmptyState>Wala pang feedback.</EmptyState>}
      </ul>
    </>
  );
}
