import { Nav } from "@/components/Nav";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/roles";
import { db } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Owners must turn on 2FA before using the system.
  if (user.role === "OWNER" && !user.totpEnabled) redirect("/setup-2fa");
  return (
    <div className="app-shell min-h-screen">
      <Nav userName={user.name} inboxCount={can(user.role, "lead_concern:read") ? await db.conversation.count({ where: { needsDoctor: true } }) : null} />
      {/* Phone top bar with the clinic logo (desktop shows it in the sidebar). */}
      <header className="flex items-center gap-2 px-4 pt-3 md:hidden print:hidden">
        <img src="/brand/logo.png" alt="" width={32} height={32} className="h-8 w-8" />
        <span className="font-semibold">Clinica Medica 101</span>
      </header>
      <main className="px-4 pb-24 pt-4 md:pb-8 md:pl-60 md:pr-8 md:pt-8 print:p-0">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
