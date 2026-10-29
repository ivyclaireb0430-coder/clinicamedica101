import { getSetting } from "./settings";

// Optional paid SMS fallback (Semaphore, Philippines). Off unless SEMAPHORE_API_KEY is set AND the owner turns it on.

export async function smsEnabled(): Promise<boolean> {
  return Boolean(process.env.SEMAPHORE_API_KEY) && (await getSetting("smsEnabled")) === "1";
}

export async function sendSms(mobile: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await smsEnabled())) return { ok: false, error: "SMS is off" };
  const body = new URLSearchParams({
    apikey: process.env.SEMAPHORE_API_KEY ?? "",
    number: mobile,
    message: message.slice(0, 450),
    ...(process.env.SEMAPHORE_SENDER_NAME ? { sendername: process.env.SEMAPHORE_SENDER_NAME } : {}),
  });
  try {
    const res = await fetch("https://api.semaphore.co/api/v4/messages", { method: "POST", body });
    return res.ok ? { ok: true } : { ok: false, error: `Semaphore ${res.status}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
