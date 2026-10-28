import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can, ROLES, ROLE_LABELS, isRole } from "@/lib/roles";
import { formatDate } from "@/lib/time";
import { BackLink, PageHeader } from "@/components/ui";
import { changePassword, createUser, toggleUserActive } from "../actions";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ pw?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const manage = can(me.role, "users:manage");
  let flash: { email: string; temp: string } | null = null;
  try {
    flash = JSON.parse((await cookies()).get("flash_temp")?.value ?? "null");
  } catch {}
  const users = manage ? await db.user.findMany({ orderBy: { createdAt: "asc" } }) : [];

  return (
    <>
      <BackLink href="/settings" label="Settings" />
      <PageHeader title="Users & roles" subtitle="Front desk can manage inquiries and bookings but never sees health information." />
      {manage && flash && (
        <div className="card mb-4 border-amber-300 bg-amber-50 text-sm">
          Account created for <b>{flash.email}</b>. Temporary password: <code className="font-mono">{flash.temp}</code>
          <br />Ibigay ito nang personal (hindi sa chat) at ipapalit agad pagka-login. Hindi na ito ipapakita ulit.
        </div>
      )}
      {sp.pw === "ok" && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Password changed.</p>}
      {sp.pw === "wrong" && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Mali ang current password.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {manage && (
          <section className="card space-y-3 md:col-span-2">
            <h2>Accounts</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <b>{u.name}</b> · {u.email} · {isRole(u.role) ? ROLE_LABELS[u.role] : u.role} · 2FA {u.totpEnabled ? "on" : "off"}
                    <span className="muted"> · since {formatDate(u.createdAt)}</span>
                    {!u.active && <span className="badge ml-2">Inactive</span>}
                  </span>
                  {u.id !== me.id && (
                    <form action={toggleUserActive.bind(null, u.id)}>
                      <button className="btn-secondary py-1 text-xs">{u.active ? "Deactivate" : "Reactivate"}</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <form action={createUser} className="grid gap-2 sm:grid-cols-4">
              <input name="name" className="input" placeholder="Name" required />
              <input name="email" type="email" className="input" placeholder="Email" required />
              <select name="role" className="input" defaultValue="FRONT_DESK">
                {ROLES.filter((r) => r !== "OWNER").map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <button className="btn">Add user</button>
            </form>
          </section>
        )}
        <section className="card space-y-3">
          <h2>Change my password</h2>
          <form action={changePassword} className="space-y-2">
            <input name="current" type="password" className="input" placeholder="Current password" autoComplete="current-password" required />
            <input name="next" type="password" className="input" placeholder="New password (12+ characters)" minLength={12} autoComplete="new-password" required />
            <button className="btn-secondary">Change password</button>
          </form>
        </section>
      </div>
    </>
  );
}
