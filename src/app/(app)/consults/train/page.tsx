import { requirePermission } from "@/lib/session";
import { BackLink, PageHeader } from "@/components/ui";
import { aiApiKey } from "@/lib/messenger/ai-context";
import { consultDoctorName, loadConsultLessons } from "@/lib/consult/store";
import { editLessonStart } from "../actions";
import { deleteDocLesson } from "./actions";
import { DocTrainerChat } from "./DocTrainerChat";

const KIND_LABELS: Record<string, string> = { STYLE: "Estilo ni Doc", QUESTION: "Tanong ni Doc", ADVICE: "General advice", FACT: "Impormasyon" };

export default async function DocTrainPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  await requirePermission("consult:train");
  const { from } = await searchParams;
  const [aiReady, lessons, doctor] = await Promise.all([aiApiKey().then(Boolean), loadConsultLessons(), consultDoctorName()]);
  const starter = from ? (await editLessonStart(from)).text : undefined;
  const order = ["STYLE", "QUESTION", "ADVICE", "FACT"];
  const sorted = [...lessons].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return (
    <>
      <BackLink href="/consults" label="Online konsulta" />
      <PageHeader title="Turuan si Doc AI" />
      <section className="card mb-4 space-y-1 text-sm">
        <p>
          Dito tinuturuan ang AI assistant na magsalita at magtanong na parang si <b>{doctor}</b>. Mag-chat lang: i-paste ang sample replies niya, ang mga tanong na lagi
          niyang tinatanong, at ang general advice niya. Kapag may natutunan ito, pindutin ang <b>Tandaan</b>. Puwede ring itanong &quot;paano mo sasagutin ang ...&quot;
          para makita ang mismong sagot nito sa pasyente.
        </p>
        <p className="muted">
          Hindi ito matuturuan ng gamot, dose o diagnosis: si {doctor} lang ang nagre-reseta, sa &quot;Para kay Doc&quot;. Walang ipinapadala sa pasyente mula rito.
        </p>
      </section>
      <section className="card mb-4">
        {aiReady ? <DocTrainerChat doctor={doctor} starter={starter} /> : <p className="text-sm">Wala pang AI API key. Ilagay muna ito sa <a className="underline" href="/settings/messenger">Messenger settings</a>.</p>}
      </section>
      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Mga natutunan ng AI ({lessons.length})</h2>
        {lessons.length === 0 && <p className="muted">Wala pa. Ang mga pinindot ninyong &quot;Tandaan&quot; ay lalabas dito.</p>}
        <ul className="divide-y divide-slate-100">
          {sorted.map((l) => (
            <li key={l.id} className="flex items-start gap-2 py-2">
              <span className="mt-0.5 whitespace-nowrap rounded bg-slate-100 px-1.5 text-[11px]">{KIND_LABELS[l.kind] ?? l.kind}</span>
              <span className="flex-1">{l.text}</span>
              <form action={deleteDocLesson}>
                <input type="hidden" name="id" value={l.id} />
                <button className="text-xs text-red-700 underline">Alisin</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
