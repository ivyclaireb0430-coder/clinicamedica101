import { auth } from "@/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { audit } from "@/lib/audit";
import { exportPerson } from "@/lib/privacy";

// Data-access request: everything held about one person as a JSON file (Owner only).
export async function GET(req: Request) {
  const session = await auth();
  const user = session?.user?.id ? await db.user.findUnique({ where: { id: session.user.id } }) : null;
  if (!user?.active || !can(user.role, "data:export")) return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId") ?? undefined;
  const leadId = url.searchParams.get("leadId") ?? undefined;
  if (!patientId && !leadId) return new Response("Missing patientId or leadId", { status: 400 });
  const data = await exportPerson({ patientId, leadId });
  if (!data.inquiry && !data.patient) return new Response("Not found", { status: 404 });
  await audit({ userId: user.id, action: "EXPORT", entity: patientId ? "Patient" : "Lead", entityId: patientId ?? leadId, detail: "data access request" });
  const name = data.patient?.patientNo ?? "inquiry";
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="personal-data-${name}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
