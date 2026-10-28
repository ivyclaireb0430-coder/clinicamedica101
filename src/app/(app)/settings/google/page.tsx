import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { googleConfigured } from "@/lib/google";
import { formatDateTime } from "@/lib/time";
import { BackLink, PageHeader } from "@/components/ui";
import { syncGoogleNow } from "../actions";

const ERRORS: Record<string, string> = {
  config: "Wala pang GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET sa server settings. Sundan ang Google setup steps sa Phase 0 plan.",
  denied: "Hindi natuloy ang pag-connect. Subukan ulit.",
  failed: "May error sa Google. Subukan ulit mamaya.",
};

export default async function GooglePage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string; synced?: string }> }) {
  const user = await requirePermission("settings:manage");
  const sp = await searchParams;
  const account = await db.googleAccount.findUnique({ where: { userId: user.id } });
  return (
    <>
      <BackLink href="/settings" label="Settings" />
      <PageHeader title="Google Calendar" subtitle="Clinic bookings appear in your Google Calendar. Your own events block those times from booking." />
      {sp.error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{ERRORS[sp.error] ?? ERRORS.failed}</p>}
      {sp.connected && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Connected!</p>}
      {sp.synced && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Synced. {sp.synced} busy events imported.</p>}
      <section className="card space-y-3 text-sm">
        <div>Status: {account ? <b>Connected{account.email ? ` (${account.email})` : ""}</b> : "Not connected"}</div>
        {account?.lastSyncAt && <div className="muted">Last sync: {formatDateTime(account.lastSyncAt)}</div>}
        <div className="flex flex-wrap gap-2">
          <a href="/api/google/connect" className="btn">{account ? "Reconnect" : "Connect Google Calendar"}</a>
          {account && (
            <form action={syncGoogleNow}>
              <button className="btn-secondary">Sync now</button>
            </form>
          )}
        </div>
        <p className="muted">
          {googleConfigured() ? "Google app is configured." : "Google app keys are not set yet."} Only name, time and consultation type are sent to
          Google. No health information.
        </p>
      </section>
    </>
  );
}
