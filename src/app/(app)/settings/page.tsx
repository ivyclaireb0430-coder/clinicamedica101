import Link from "next/link";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { ROLE_LABELS, isRole } from "@/lib/roles";
import { PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const user = await requireUser();
  const sections = [
    { href: "/settings/schedule", title: "Schedule, fees & closed dates", desc: "Clinic hours, consultation types, blocked dates", show: can(user.role, "booking:write") },
    { href: "/settings/campaigns", title: "Campaigns & tracking links", desc: "Know which channel brings patients", show: can(user.role, "settings:manage") },
    { href: "/settings/google", title: "Google Calendar", desc: "Two-way sync with your calendar", show: can(user.role, "settings:manage") },
    { href: "/settings/users", title: "Users & roles", desc: "Add front desk or doctor accounts later", show: can(user.role, "users:manage") },
  ];
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  return (
    <>
      <PageHeader title="Settings" subtitle={`${user.name} · ${isRole(user.role) ? ROLE_LABELS[user.role] : user.role} · 2FA ${user.totpEnabled ? "on" : "off"}`} />
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.filter((s) => s.show).map((s) => (
          <Link key={s.href} href={s.href} className="card hover:border-brand-500">
            <div className="font-medium">{s.title}</div>
            <div className="muted">{s.desc}</div>
          </Link>
        ))}
      </div>
      <form action={logout} className="mt-6">
        <button className="btn-secondary">Sign out</button>
      </form>
    </>
  );
}
