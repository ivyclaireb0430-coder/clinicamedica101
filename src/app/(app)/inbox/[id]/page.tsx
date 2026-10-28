import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { decrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { formatDate, formatDateTime, formatTime } from "@/lib/time";
import { HUMAN_AGENT_WINDOW_MS, withinWindow } from "@/lib/messenger/meta";
import { BackLink } from "@/components/ui";
import { ReplyBox } from "@/components/ReplyBox";
import { markHandled, sendReply, setPaused } from "../actions";

const ERRORS: Record<string, string> = {
  window: "Lampas na sa 7 araw mula sa huling message ng pasyente, kaya hindi na puwedeng mag-reply sa Messenger (Meta rule). Tawagan o i-email na lang.",
  send: "Hindi naipadala ang message. Tingnan kung naka-connect ang Facebook Page.",
};

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requirePermission("lead_concern:read");
  const { id } = await params;
  const { error } = await searchParams;
  const convo = await db.conversation.findUnique({
    where: { id },
    include: { lead: true, messages: { orderBy: { createdAt: "desc" }, take: 300 } },
  });
  if (!convo) notFound();
  await db.conversation.update({ where: { id }, data: { unread: 0 } });
  await audit({ userId: user.id, action: "VIEW", entity: "Conversation", entityId: id });

  const scripts = await db.script.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, title: true, body: true } });
  const upcoming = await db.appointment.findFirst({
    where: { leadId: convo.leadId, status: { in: ["BOOKED", "CONFIRMED"] }, startAt: { gt: new Date() } },
    orderBy: { startAt: "asc" },
  });
  const values: Record<string, string> = { first_name: convo.lead.firstName };
  if (upcoming) Object.assign(values, { date: formatDate(upcoming.startAt), time: formatTime(upcoming.startAt) });
  const inWindow = withinWindow(convo.lastUserMessageAt);
  const inAgentWindow = withinWindow(convo.lastUserMessageAt, new Date(), HUMAN_AGENT_WINDOW_MS);

  return (
    <>
      <BackLink href="/inbox" label="Inbox" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1>{convo.lead.firstName} {convo.lead.lastName}</h1>
          <Link href={`/leads/${convo.leadId}`} className="text-sm text-brand-700 hover:underline">Open lead record →</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {convo.needsDoctor && (
            <form action={markHandled.bind(null, id)}>
              <button className="btn-secondary">Mark handled</button>
            </form>
          )}
          <form action={setPaused.bind(null, id, !convo.automationPaused)}>
            <button className={convo.automationPaused ? "btn" : "btn-secondary"}>
              {convo.automationPaused ? "Resume auto-replies" : "Pause auto-replies"}
            </button>
          </form>
        </div>
      </div>
      {convo.needsDoctor && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Naghihintay ng sagot ng doktor.</p>}
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERRORS[error] ?? error}</p>}

      {/* Newest at the bottom; column-reverse keeps the scroll pinned to the latest message. */}
      <div className="card mb-4 flex max-h-[55vh] flex-col-reverse gap-2 overflow-y-auto">
        {convo.messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "OUT" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.direction === "OUT" ? (m.sender === "BOT" ? "bg-slate-100" : "bg-brand-600 text-white") : "border border-slate-200 bg-white"}`}>
              <p className="whitespace-pre-wrap">{decrypt(m.textEnc)}</p>
              <p className={`mt-1 text-[10px] ${m.direction === "OUT" && m.sender !== "BOT" ? "text-brand-100" : "text-slate-400"}`}>
                {m.sender === "BOT" ? "Auto-reply" : m.sender === "PATIENT" ? "Patient" : m.sender === "PAGE" ? "Page inbox" : "You"} · {formatDateTime(m.createdAt)}
                {m.status === "FAILED" ? " · not delivered" : ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      <section className="card">
        {!inWindow && inAgentWindow && <p className="muted mb-2">Lampas 24 oras na: ipapadala ito bilang “human agent” reply (puwede hanggang 7 araw).</p>}
        <ReplyBox action={sendReply.bind(null, id)} scripts={scripts} values={values} disabled={!inAgentWindow} />
      </section>
    </>
  );
}
