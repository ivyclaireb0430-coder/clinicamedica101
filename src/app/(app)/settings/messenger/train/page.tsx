import { requirePermission } from "@/lib/session";
import { BackLink, PageHeader } from "@/components/ui";
import { aiApiKey, loadLessons } from "@/lib/messenger/ai-context";
import { deleteAiLesson } from "../../actions";
import { TrainerChat } from "./TrainerChat";

export default async function TrainAiPage() {
  await requirePermission("settings:manage");
  const [aiReady, lessons] = await Promise.all([aiApiKey().then(Boolean), loadLessons()]);
  return (
    <>
      <BackLink href="/settings/messenger" label="Messenger & reminders" />
      <PageHeader title="Turuan ang AI" />
      <section className="card mb-4 space-y-1 text-sm">
        <p>
          Kausapin ang AI para turuan ito: mga impormasyon tungkol sa clinic at kung paano ninyo gustong sumagot ito. Kapag may natutunan
          ito, pindutin ang <b>Tandaan</b> at gagamitin na ito sa mga sagot sa Messenger. Puwede ring itanong &quot;paano mo sasagutin
          ang ...&quot; para makita ang mismong sagot nito.
        </p>
        <p className="muted">
          Hindi nito malalampasan ang safety rules: hindi ito magbibigay ng diagnosis o gamot, at ipapasa pa rin sa doktor ang mga emergency.
          Walang ipinapadala sa pasyente mula rito.
        </p>
      </section>
      <section className="card mb-4">
        {aiReady ? <TrainerChat /> : <p className="text-sm">Wala pang AI API key. Ilagay muna ito sa <a className="underline" href="/settings/messenger">Messenger settings</a>.</p>}
      </section>
      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Mga natutunan ng AI ({lessons.length})</h2>
        {lessons.length === 0 && <p className="muted">Wala pa. Ang mga pinindot ninyong &quot;Tandaan&quot; ay lalabas dito.</p>}
        <ul className="divide-y divide-slate-100">
          {lessons.map((l) => (
            <li key={l.id} className="flex items-start gap-2 py-2">
              <span className="mt-0.5 rounded bg-slate-100 px-1.5 text-[11px]">{l.kind === "FACT" ? "Impormasyon" : "Paraan ng pagsagot"}</span>
              <span className="flex-1">{l.text}</span>
              <form action={deleteAiLesson}>
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
