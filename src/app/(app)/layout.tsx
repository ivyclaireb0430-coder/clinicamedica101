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
    <div className="min-h-screen">
      <Nav userName={user.name} inboxCount={can(user.role, "lead_concern:read") ? await db.conversation.count({ where: { needsDoctor: true } }) : null} />
      <main className="px-4 pb-24 pt-4 md:pb-8 md:pl-60 md:pr-8 md:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
