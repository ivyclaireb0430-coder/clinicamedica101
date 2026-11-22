"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notifyDoctor } from "@/lib/notify";
import { renderScript } from "@/lib/scripts";
import { formatDate, formatTime } from "@/lib/time";
import { SlotTakenError, createAppointment } from "@/lib/booking";
import { createRateLimiter, PREFERRED_TIMES } from "@/lib/funnel";
import { isOpenSlot } from "@/lib/funnel-db";
import { verifyBookingToken } from "@/lib/messenger/booking-link";
import { normalizeEmail, normalizePhMobile } from "@/lib/messenger/bot";
import { sendText } from "@/lib/messenger/meta";
import { storeOutgoing } from "@/lib/messenger/handler";

// 8 submissions per hour per chat link.
const allow = createRateLimiter(8, 60 * 60 * 1000);

export async function submitMessengerBooking(token: string, formData: FormData) {
  const conversationId = verifyBookingToken(token);
  if (!conversationId) redirect(`/book/${encodeURIComponent(token)}`);
  const conversation = await db.conversation.findUnique({ where: { id: conversationId! }, include: { lead: true } });
  if (!conversation) redirect(`/book/${encodeURIComponent(token)}`);
  const convo = conversation!;

  const typeId = String(formData.get("typeId") ?? "");
  const back = (error: string): never => redirect(`/book/${token}?${new URLSearchParams({ type: typeId, error })}#form`);
  if (!allow(conversationId!)) back("Masyadong maraming subok. Paki-message na lang po kami sa Messenger.");

  const fullName = String(formData.get("fullName") ?? "").trim().replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 80) back("Pakilagay po ang inyong buong pangalan.");
  const mobile = normalizePhMobile(String(formData.get("mobile") ?? ""));
  if (!mobile) back("Pakilagay po ang tamang mobile number (hal. 0917 123 4567).");
  const emailRaw = String(formData.get("email") ?? "").trim();
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  if (emailRaw && !email) back("Pakisuri po ang email address.");

  const type = await db.consultationType.findFirst({ where: { id: typeId, active: true } });
  if (!type) back("Pakipili po ang klase ng consultation.");
  const callMe = formData.get("callMe") === "1";
  const slotRaw = String(formData.get("slotStart") ?? "");
  const slotStart = slotRaw ? new Date(slotRaw) : null;
  if (!callMe && (!slotStart || Number.isNaN(slotStart.getTime()))) back("Pakipili po ng petsa at oras sa calendar.");

  const [first, ...rest] = fullName.split(" ");
  await db.lead.update({
    where: { id: convo.leadId },
    data: { firstName: first, lastName: rest.join(" ") || null, mobile, ...(email ? { email } : {}) },
  });

  if (callMe) {
    const pref = PREFERRED_TIMES.find((t) => t.key === formData.get("preferredTime"))?.label ?? "Kahit kailan";
    await db.conversation.update({ where: { id: convo.id }, data: { needsDoctor: true, needsDoctorAt: new Date(), flowState: null } });
    await audit({ action: "UPDATE", entity: "Lead", entityId: convo.leadId, detail: `Messenger booking form: wants a call (${pref})` });
    await notifyDoctor().catch(() => undefined);
    await tellInMessenger(convo.id, convo.psid, `Salamat po, ${first}! Natanggap na po namin. Kokontakin po namin kayo para sa schedule (${pref.toLowerCase()}).`);
    redirect(`/book/${token}?done=call`);
  }

  if (!(await isOpenSlot(type!.id, slotStart!))) back("Pasensya na po, may nakakuha na ng oras na iyan. Pakipili ng ibang oras.");
  let appt;
  try {
    appt = await createAppointment({ leadId: convo.leadId, consultationTypeId: type!.id, startAt: slotStart!, channel: "MESSENGER", notes: "Booked from the Messenger booking form" });
  } catch (err) {
    if (err instanceof SlotTakenError) back("Pasensya na po, may nakakuha na ng oras na iyan. Pakipili ng ibang oras.");
    throw err;
  }
  // The confirmation goes out in Messenger right now; record it so the reminder job doesn't repeat it.
  await db.reminder.create({ data: { appointmentId: appt!.id, kind: "CONFIRMATION", channel: "MESSENGER", status: "SENT" } });
  await db.conversation.update({ where: { id: convo.id }, data: { flowState: null } });
  const script = await db.script.findUnique({ where: { key: "booking_confirm" } });
  const text = renderScript(
    script?.body ?? "Confirmed na po, {first_name}! Ang inyong consultation ay sa {date}, {time}.",
    { first_name: first, date: formatDate(appt!.startAt), time: formatTime(appt!.startAt) },
  );
  await tellInMessenger(convo.id, convo.psid, text);
  redirect(`/book/${token}?done=${encodeURIComponent(appt!.startAt.toISOString())}`);
}

async function tellInMessenger(conversationId: string, psid: string, text: string) {
  const result = await sendText(psid, { text });
  await storeOutgoing(conversationId, text, "BOT", result);
}
