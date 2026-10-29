import Link from "next/link";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { ROLE_LABELS, isRole } from "@/lib/roles";
import { PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const user = await requireUser();
  const sections = [
    { href: "/followups", title: "Follow-up", desc: "Due follow-ups, missed sessions, recall list, feedback", show: can(user.role, "booking:read") },
    { href: "/billing", title: "Billing", desc: "Daily collections, receivables, monthly report", show: can(user.role, "billing:read") },
    { href: "/settings/exports", title: "Reports & exports", desc: "Monday summary email, CSV downloads", show: can(user.role, "reports:read") },
    { href: "/settings/audit", title: "Audit log", desc: "Who viewed or changed patient records", show: can(user.role, "audit:read") },
    { href: "/settings/followup", title: "Follow-up & billing settings", desc: "Recall timing, feedback requests, receipt header", show: can(user.role, "settings:manage") },
    { href: "/settings/schedule", title: "Schedule, fees & closed dates", desc: "Clinic hours, consultation types, blocked dates", show: can(user.role, "booking:write") },
    { href: "/settings/messenger", title: "Messenger & reminders", desc: "Auto-replies, reminders, SMS, takeover", show: can(user.role, "settings:manage") },
    { href: "/scripts", title: "Saved scripts", desc: "Taglish replies used by the bot and inbox", show: true },
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
      <PageHeader title="More" subtitle={`${user.name} · ${isRole(user.role) ? ROLE_LABELS[user.role] : user.role} · 2FA ${user.totpEnabled ? "on" : "off"}`} />
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
