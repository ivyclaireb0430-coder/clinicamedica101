import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { CHANNELS } from "@/lib/constants";
import { BackLink, PageHeader } from "@/components/ui";
import Link from "next/link";
import { addDays, startOfWeek, todayManila } from "@/lib/time";
import { createCampaign, saveCampaignStat } from "../actions";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ week?: string; saved?: string }> }) {
  await requirePermission("settings:manage");
  const sp = await searchParams;
  const week = startOfWeek(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : todayManila());
  const campaigns = await db.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } }, stats: { where: { weekStart: week } } },
  });
  const page = process.env.FB_PAGE_USERNAME || "YourPageName";
  return (
    <>
      <BackLink href="/settings" label="More" />
      <PageHeader title="Campaigns & tracking links" subtitle="Use the m.me link in a post or reel so every Messenger inquiry is tagged to that campaign." />
      <form action={createCampaign} className="card mb-4 grid gap-2 sm:grid-cols-4">
        <input name="name" className="input" placeholder="Campaign name" required />
        <select name="channel" className="input">
          {CHANNELS.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <input name="trackingCode" className="input" placeholder="code e.g. reel-headache" required />
        <button className="btn">Add campaign</button>
      </form>
      {sp.saved && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Views/likes saved.</p>}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="muted">Views/likes for week of</span>
        <Link href={`/settings/campaigns?week=${addDays(week, -7)}`} className="btn-secondary">←</Link>
        <b>{week}</b>
        <Link href={`/settings/campaigns?week=${addDays(week, 7)}`} className="btn-secondary">→</Link>
      </div>
      <ul className="space-y-2">
        {campaigns.map((c) => (
          <li key={c.id} className="card text-sm">
            <div className="flex justify-between gap-2">
              <b>{c.name}</b>
              <span className="badge">{c._count.leads} leads</span>
            </div>
            <code className="block break-all text-xs text-slate-600">https://m.me/{page}?ref={c.trackingCode}</code>
            <form action={saveCampaignStat.bind(null, c.id, week)} className="mt-2 flex flex-wrap items-end gap-2">
              <label><span className="label">Views</span><input className="input w-28" name="views" type="number" min={0} defaultValue={c.stats[0]?.views ?? ""} /></label>
              <label><span className="label">Likes</span><input className="input w-28" name="likes" type="number" min={0} defaultValue={c.stats[0]?.likes ?? ""} /></label>
              <button className="btn-secondary">Save</button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
