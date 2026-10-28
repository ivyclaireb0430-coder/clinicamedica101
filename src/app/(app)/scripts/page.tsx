import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/roles";
import { PageHeader } from "@/components/ui";
import { saveScript } from "./actions";
import { SCRIPTS as DEFAULT_SCRIPTS } from "../../../../prisma/seed-data";

export default async function ScriptsPage() {
  const user = await requirePermission("leads:read");
  const editable = can(user.role, "scripts:write");
  // Add any default scripts introduced by newer versions without touching edited ones.
  const existing = new Set((await db.script.findMany({ select: { key: true } })).map((s) => s.key));
  for (const [i, s] of DEFAULT_SCRIPTS.entries()) {
    if (!existing.has(s.key)) await db.script.create({ data: { ...s, sortOrder: i } });
  }
  const scripts = await db.script.findMany({ orderBy: [{ sortOrder: "asc" }] });
  const categories = [...new Set(scripts.map((s) => s.category))];

  return (
    <>
      <PageHeader
        title="Saved scripts"
        subtitle="Taglish replies for Messenger. Placeholders: {first_name}, {date}, {time}. Walang medical claims o pangakong resulta."
      />
      {categories.map((cat) => (
        <section key={cat} className="mb-6">
          <h2 className="mb-2 text-slate-600">{cat}</h2>
          <div className="space-y-3">
            {scripts
              .filter((s) => s.category === cat)
              .map((s) =>
                editable ? (
                  <form key={s.id} action={saveScript.bind(null, s.id)} className="card space-y-2">
                    <input className="input font-medium" name="title" defaultValue={s.title} />
                    <textarea className="input" name="body" rows={5} defaultValue={s.body} />
                    <button className="btn-secondary">Save</button>
                  </form>
                ) : (
                  <div key={s.id} className="card space-y-1">
                    <div className="font-medium">{s.title}</div>
                    <p className="whitespace-pre-wrap text-sm">{s.body}</p>
                  </div>
                ),
              )}
          </div>
        </section>
      ))}
    </>
  );
}
