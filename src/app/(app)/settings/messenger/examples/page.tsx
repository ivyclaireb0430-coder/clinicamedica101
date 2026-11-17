import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { decrypt, decryptOptional } from "@/lib/crypto";
import { messengerConfigured } from "@/lib/messenger/meta";
import { formatDate } from "@/lib/time";
import { BackLink, PageHeader } from "@/components/ui";
import { collectAiExamples, setAiExample } from "../../actions";

export default async function AiExamplesPage({ searchParams }: { searchParams: Promise<{ added?: string; fb_error?: string; show?: string }> }) {
  await requirePermission("settings:manage");
  const sp = await searchParams;
  const showApproved = sp.show === "approved";
  const [rows, approvedCount, pendingCount] = await Promise.all([
    db.aiExample.findMany({ where: { approved: showApproved }, orderBy: { repliedAt: "desc" }, take: 100 }),
    db.aiExample.count({ where: { approved: true } }),
    db.aiExample.count({ where: { approved: false } }),
  ]);

  return (
    <>
      <BackLink href="/settings/messenger" label="Messenger & reminders" />
      <PageHeader title="Halimbawang reply para sa AI" />
      {sp.added && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Nakakuha ng {sp.added} bagong reply na puwedeng i-review.</p>}
      {sp.fb_error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Facebook: {sp.fb_error}</p>}

      <section className="card mb-4 space-y-2 text-sm">
        <p>
          Ginagaya ng AI ang tono at paraan ng pagsagot sa mga reply na <b>inaprubahan</b> ninyo dito (hanggang 25 na pinakabago).
          Tono lang ang kinokopya. Ang presyo, promo at oras ay galing pa rin sa Settings. Tinatanggal ang pangalan, mobile number,
          email at link ng pasyente, at hindi kinukuha ang mga reply ng bot o ang mga reply na may payo tungkol sa gamot.
        </p>
        <form action={collectAiExamples} className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="facebook" defaultChecked={messengerConfigured()} disabled={!messengerConfigured()} />
            Isama ang mga lumang usapan sa Facebook Page
          </label>
          <button className="btn">Kunin ang mga dating reply</button>
        </form>
      </section>

      <div className="mb-3 flex gap-2 text-sm">
        <a href="/settings/messenger/examples" className={showApproved ? "btn-secondary" : "btn"}>I-review ({pendingCount})</a>
        <a href="/settings/messenger/examples?show=approved" className={showApproved ? "btn" : "btn-secondary"}>Ginagamit ng AI ({approvedCount})</a>
      </div>

      {rows.length === 0 && <p className="muted text-sm">Wala pa dito.</p>}
      <div className="space-y-2">
        {rows.map((r) => {
          const q = decryptOptional(r.questionEnc);
          return (
            <div key={r.id} className="card space-y-2 text-sm">
              {q && <p className="whitespace-pre-wrap text-slate-500">Pasyente: {q}</p>}
              <p className="whitespace-pre-wrap">Clinic: {decrypt(r.replyEnc)}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="muted text-xs">
                  {r.source === "FACEBOOK" ? "Facebook Page" : "Inbox"}
                  {r.repliedAt ? ` · ${formatDate(r.repliedAt)}` : ""}
                </span>
                <form action={setAiExample}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="op" value={r.approved ? "unapprove" : "approve"} />
                  <button className={r.approved ? "btn-secondary" : "btn"}>{r.approved ? "Huwag nang gamitin" : "Gamitin"}</button>
                </form>
                <form action={setAiExample}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="op" value="delete" />
                  <button className="btn-secondary">Burahin</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
