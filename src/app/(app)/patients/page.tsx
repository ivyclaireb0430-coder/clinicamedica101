import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { formatDate } from "@/lib/time";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("leads:read");
  const { q } = await searchParams;
  const search = q?.trim();
  const patients = await db.patient.findMany({
    where: search
      ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { patientNo: { contains: search } }, { mobile: { contains: search } }] }
      : {},
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { _count: { select: { plans: true } } },
  });
  return (
    <>
      <PageHeader title="Patients" subtitle="Convert a lead to a patient from the lead's page (no re-typing)." />
      <form className="mb-4 flex gap-2" action="/patients">
        <input className="input" name="q" placeholder="Search name, CM number, or mobile" defaultValue={search} />
        <button className="btn-secondary">Search</button>
      </form>
      {patients.length === 0 ? (
        <EmptyState>Wala pang patients{search ? " na tugma" : ""}.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {patients.map((p) => (
            <li key={p.id}>
              <Link href={`/patients/${p.id}`} className="card flex items-center justify-between gap-3 p-3 hover:border-brand-500">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.firstName} {p.lastName}</div>
                  <div className="muted text-xs">{p.patientNo} · since {formatDate(p.createdAt)}{p.mobile ? ` · ${p.mobile}` : ""}</div>
                </div>
                {p._count.plans > 0 && <span className="badge">{p._count.plans} plan{p._count.plans > 1 ? "s" : ""}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
