import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { resetaProps } from "@/lib/consult/store";
import { EReseta } from "@/components/EReseta";
import { PrintButton } from "@/components/PrintButton";
import { BackLink } from "@/components/ui";

export const metadata = { title: "e-Reseta · Clinica Medica 101" };

export default async function DoctorResetaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("consult:review");
  const { id } = await params;
  const s = await db.consultSession.findUnique({ where: { id } });
  if (!s?.prescriptionEnc) notFound();
  await audit({ userId: user.id, action: "EXPORT", entity: "ConsultSession", entityId: id, detail: "e-reseta" });
  return (
    <>
      <div className="mb-3 flex items-center justify-between print:hidden">
        <BackLink href={`/consults/${id}`} label="Konsulta" />
        <PrintButton />
      </div>
      <EReseta {...await resetaProps(s)} />
    </>
  );
}
