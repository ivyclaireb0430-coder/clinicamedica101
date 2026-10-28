import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { CHANNELS } from "@/lib/constants";
import { BackLink, PageHeader } from "@/components/ui";
import { createCampaign } from "../actions";

export default async function CampaignsPage() {
  await requirePermission("settings:manage");
  const campaigns = await db.campaign.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { leads: true } } } });
  const page = process.env.FB_PAGE_USERNAME || "YourPageName";
  return (
    <>
      <BackLink href="/settings" label="Settings" />
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
      <ul className="space-y-2">
        {campaigns.map((c) => (
          <li key={c.id} className="card text-sm">
            <div className="flex justify-between gap-2">
              <b>{c.name}</b>
              <span className="badge">{c._count.leads} leads</span>
            </div>
            <code className="block break-all text-xs text-slate-600">https://m.me/{page}?ref={c.trackingCode}</code>
          </li>
        ))}
      </ul>
    </>
  );
}
