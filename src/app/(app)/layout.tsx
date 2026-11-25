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
      <Nav userName={user.name} inboxCount={can(user.role, "lead_concern:read") ? await db.conversation.count({ where: { needsDoctor: true } }) : null}
        consultCount={can(user.role, "consult:review") ? await db.consultSession.count({ where: { OR: [{ status: "SUBMITTED" }, { status: "EMERGENCY", closedAt: null }] } }) : null}
      />
      <main className="px-4 pb-24 pt-4 md:pb-8 md:pl-60 md:pr-8 md:pt-8 print:p-0">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
