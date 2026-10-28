"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/session";
import {
  SlotTakenError, createAppointment, rescheduleAppointment, setAppointmentStatus,
} from "@/lib/booking";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/constants";

export async function bookAppointment(formData: FormData) {
  const user = await requirePermission("booking:write");
  const leadId = String(formData.get("leadId"));
  const typeId = String(formData.get("consultationTypeId"));
  const start = new Date(String(formData.get("startAt")));
  let id: string;
  try {
    id = (await createAppointment({ leadId, consultationTypeId: typeId, startAt: start, userId: user.id, notes: String(formData.get("notes") ?? "") || undefined })).id;
  } catch (err) {
    if (err instanceof SlotTakenError) redirect(`/calendar/new?leadId=${leadId}&typeId=${typeId}&error=taken`);
    throw err;
  }
  redirect(`/appointments/${id}?booked=1`);
}

export async function updateStatus(id: string, formData: FormData) {
  const user = await requirePermission("booking:write");
  const status = String(formData.get("status"));
  if (!APPOINTMENT_STATUSES.some((s) => s.key === status)) throw new Error("Bad status");
  await setAppointmentStatus(id, status as AppointmentStatus, user.id);
  revalidatePath(`/appointments/${id}`);
  revalidatePath("/calendar");
}

export async function reschedule(id: string, formData: FormData) {
  const user = await requirePermission("booking:write");
  try {
    const fresh = await rescheduleAppointment(id, new Date(String(formData.get("startAt"))), user.id);
    redirect(`/appointments/${fresh.id}?rescheduled=1`);
  } catch (err) {
    if (err instanceof SlotTakenError) redirect(`/appointments/${id}?error=taken`);
    throw err;
  }
}
