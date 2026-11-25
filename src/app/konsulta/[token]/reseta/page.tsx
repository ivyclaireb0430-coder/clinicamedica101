import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { consultCookieName, consultCookieValid, resetaProps } from "@/lib/consult/store";
import { EReseta } from "@/components/EReseta";
import { PrintButton } from "@/components/PrintButton";
import { KonsultaShell } from "../../Shell";

export const metadata = { title: "e-Reseta · Clinica Medica 101", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PatientResetaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await db.consultSession.findUnique({ where: { token } });
  if (!session || session.status !== "SENT" || !session.prescriptionEnc) notFound();
  if (!consultCookieValid(session.id, (await cookies()).get(consultCookieName(session.id))?.value)) notFound();
  await audit({ action: "VIEW", entity: "ConsultSession", entityId: session.id, detail: "patient opened e-reseta" });
  return (
    <KonsultaShell wide>
      <div className="mb-3 flex justify-center gap-2 print:hidden">
        <PrintButton label="I-print / Save as PDF" />
        <a href={`/konsulta/${token}`} className="btn-secondary">Bumalik</a>
      </div>
      <EReseta {...await resetaProps(session)} />
    </KonsultaShell>
  );
}
