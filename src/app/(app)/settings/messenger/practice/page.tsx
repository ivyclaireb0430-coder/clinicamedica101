import { requirePermission } from "@/lib/session";
import { BackLink, PageHeader } from "@/components/ui";
import { aiApiKey } from "@/lib/messenger/ai-context";
import { db } from "@/lib/db";
import { unfilledBlanks } from "@/lib/scripts";
import { PracticeChat } from "./PracticeChat";

export default async function PracticeChatPage() {
  await requirePermission("settings:manage");
  const aiReady = Boolean(await aiApiKey());
  // [link] is filled in automatically; other [brackets] are blanks the clinic still has to fill.
  const scripts = await db.script.findMany({ select: { key: true, title: true, body: true }, orderBy: { key: "asc" } });
  const blanks = scripts
    .map((s) => ({ title: s.title, blanks: unfilledBlanks(s.body).filter((b) => b !== "[link]") }))
    .filter((s) => s.blanks.length > 0);
  return (
    <>
      <BackLink href="/settings/messenger" label="Messenger & reminders" />
      <PageHeader title="Practice chat (Messenger bot at AI)" />
      {blanks.length > 0 && (
        <section className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">May mga script na may hindi pa napupunang bahagi. Makikita ito ng pasyente kapag hindi inayos:</p>
          <ul className="mt-1 list-disc pl-5">
            {blanks.map((b) => (
              <li key={b.title}>{b.title}: {b.blanks.join(", ")}</li>
            ))}
          </ul>
          <a className="underline" href="/scripts">Ayusin sa Scripts →</a>
        </section>
      )}
      <section className="card mb-4 space-y-1 text-sm">
        <p>
          Kausapin ang bot na parang pasyente, kasama ang mga button at booking. Ganito mismo ang isasagot nito sa Messenger, gamit ang
          kasalukuyang scripts, presyo, schedule at mga halimbawang reply.
        </p>
        <p className="muted">
          Practice lang ito: walang ipinapadala sa Facebook at walang nase-save na appointment o lead. Ang mga kulay-dilaw na linya ay
          nagsasabi kung ano sana ang gagawin ng app (hal. aabisuhan ang doktor).
        </p>
      </section>
      <section className="card">
        <PracticeChat aiReady={aiReady} />
      </section>
    </>
  );
}
