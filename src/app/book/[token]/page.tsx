import Link from "next/link";
import { db } from "@/lib/db";
import { formatPhp } from "@/lib/time";
import { PREFERRED_TIMES } from "@/lib/funnel";
import { bookableDays } from "@/lib/funnel-db";
import { verifyBookingToken } from "@/lib/messenger/booking-link";
import { SlotPicker } from "@/app/start/SlotPicker";
import { submitMessengerBooking } from "./actions";

export const metadata = { title: "Mag-book · Clinica Medica 101", robots: { index: false } };
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-cm-sky to-white px-4 py-6">
      <div className="mx-auto max-w-lg">
        <p className="mb-4 text-center text-lg font-extrabold text-cm-navy">Clinica Medica 101</p>
        {children}
      </div>
    </main>
  );
}

export default async function MessengerBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ type?: string; error?: string; done?: string }>;
}) {
  const { token } = await params;
  const { type: typeParam, error, done } = await searchParams;
  const conversationId = verifyBookingToken(token);
  const conversation = conversationId ? await db.conversation.findUnique({ where: { id: conversationId }, include: { lead: true } }) : null;

  if (!conversation) {
    return (
      <Shell>
        <div className="card space-y-2 text-center">
          <h1 className="text-xl font-bold">Expired na po ang link na ito</h1>
          <p className="text-sm">Bumalik lang po sa Messenger at i-type ang &quot;Mag-book&quot; para sa bagong link.</p>
        </div>
      </Shell>
    );
  }

  if (done) {
    const at = done === "call" ? null : new Date(done);
    return (
      <Shell>
        <div className="card space-y-3 text-center">
          <h1 className="text-xl font-bold">{at ? "Naka-book na po! ✅" : "Salamat po! ✅"}</h1>
          {at && !Number.isNaN(at.getTime()) ? (
            <p className="text-base font-semibold text-cm-red">📅 {when.format(at)}</p>
          ) : (
            <p className="text-sm">Kokontakin po namin kayo para sa schedule.</p>
          )}
          <p className="text-sm text-slate-600">Ipinadala na rin po namin ang confirmation sa Messenger. Puwede na pong isara ang page na ito.</p>
        </div>
      </Shell>
    );
  }

  const types = await db.consultationType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const type = types.find((t) => t.id === typeParam) ?? types[0];
  const days = type ? await bookableDays(type.id) : [];
  const lead = conversation.lead;
  const knownName = lead.firstName === "Messenger user" ? "" : [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  const action = submitMessengerBooking.bind(null, token);

  return (
    <Shell>
      <div id="form" className="card space-y-4">
        <h1 className="text-xl font-bold text-cm-navy">Mag-book ng consultation</h1>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!type ? (
          <p className="text-sm">Pasensya na po, wala pang bukas na booking. Mag-message lang po sa amin sa Messenger.</p>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="typeId" value={type.id} />
            {types.length > 1 && (
              <div>
                <p className="label">Klase ng consultation</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {types.map((t) => (
                    <Link
                      key={t.id}
                      href={`/book/${token}?type=${t.id}`}
                      replace
                      scroll={false}
                      className={`rounded-lg border-2 px-3 py-2 text-sm ${t.id === type.id ? "border-cm-blue bg-cm-sky font-semibold text-cm-navy" : "border-slate-200 bg-white text-slate-700"}`}
                    >
                      {t.id === type.id ? "● " : "○ "}{t.name} <span className="text-slate-500">({formatPhp(t.feePhp)})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <SlotPicker
              key={type.id}
              days={days}
              labels={{
                title: "Pumili ng petsa at oras",
                help: "Pindutin ang petsa sa calendar, tapos ang oras. Gamitin ang ‹ › para sa ibang buwan.",
                callMe: "Wala po rito ang gusto kong petsa. Kontakin na lang po ako.",
                none: "Wala pong bakanteng oras online ngayon. Ilagay lang po ang detalye at kokontakin namin kayo.",
                when: "Kailan po kayo mas libre?",
                required: "Pakipili po ng petsa at oras.",
                chosen: "Napili ninyo:",
              }}
              times={PREFERRED_TIMES.map((t) => ({ key: t.key, label: t.label }))}
            />
            <label className="block"><span className="label">Buong pangalan *</span>
              <input className="input" name="fullName" required minLength={2} maxLength={80} autoComplete="name" defaultValue={knownName} />
            </label>
            <label className="block"><span className="label">Mobile number *</span>
              <input className="input" name="mobile" required inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" defaultValue={lead.mobile ?? ""} />
            </label>
            <label className="block"><span className="label">Email</span>
              <input className="input" name="email" type="email" autoComplete="email" placeholder="juan@gmail.com" defaultValue={lead.email ?? ""} />
            </label>
            <button className="w-full rounded-xl bg-cm-red px-4 py-3 text-base font-bold text-white shadow hover:opacity-90">I-book ang schedule</button>
            <p className="text-center text-xs text-slate-500">
              Gagamitin lang po ang inyong detalye para sa appointment. <a className="underline" href="/privacy">Privacy Notice</a>
            </p>
          </form>
        )}
      </div>
    </Shell>
  );
}
