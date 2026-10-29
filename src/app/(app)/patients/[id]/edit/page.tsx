import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { BackLink, PageHeader } from "@/components/ui";
import { updatePatient } from "../../actions";

export default async function EditPatient({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("leads:write");
  const { id } = await params;
  const p = await db.patient.findUnique({ where: { id } });
  if (!p) notFound();
  const f = (name: keyof typeof p, label: string, type = "text") => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} type={type} defaultValue={(p[name] as string | null) ?? ""} />
    </div>
  );
  return (
    <>
      <BackLink href={`/patients/${id}`} label="Back" />
      <PageHeader title={`Edit ${p.firstName}`} subtitle={p.patientNo} />
      <form action={updatePatient.bind(null, id)} className="card grid gap-3 sm:grid-cols-2">
        {f("firstName", "First name")}
        {f("lastName", "Last name")}
        {f("birthDate", "Birthday", "date")}
        <div>
          <label className="label" htmlFor="sex">Sex</label>
          <select className="input" id="sex" name="sex" defaultValue={p.sex ?? ""}>
            <option value="">—</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
            <option value="UNDISCLOSED">Prefer not to say</option>
          </select>
        </div>
        {f("mobile", "Mobile", "tel")}
        {f("email", "Email", "email")}
        {f("address", "Address")}
        {f("occupation", "Occupation")}
        {f("emergencyContact", "Emergency contact")}
        <div className="sm:col-span-2"><button className="btn">Save</button></div>
      </form>
    </>
  );
}
