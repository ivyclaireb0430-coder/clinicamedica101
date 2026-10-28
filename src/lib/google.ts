import { db } from "./db";
import { decrypt, decryptOptional, encrypt } from "./crypto";
import { audit } from "./audit";

// Google Calendar two-way sync over the REST API.
// Only scheduling info goes to Google: first name + last initial and consultation type. Never health data.

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];
const CAL_API = "https://www.googleapis.com/calendar/v3";
const APP_TAG = "cm101AppointmentId";
const SYNC_DAYS_AHEAD = 60;

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  return `${process.env.APP_URL ?? "http://localhost:3000"}/api/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; id_token?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status})`);
  return res.json();
}

export async function connectGoogle(userId: string, code: string) {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  let email: string | null = null;
  if (tokens.id_token) {
    const payload = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8"));
    email = payload.email ?? null;
  }
  const data = {
    email,
    accessTokenEnc: encrypt(tokens.access_token),
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    ...(tokens.refresh_token ? { refreshTokenEnc: encrypt(tokens.refresh_token) } : {}),
  };
  await db.googleAccount.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  await audit({ userId, action: "CONNECT", entity: "GoogleAccount" });
}

/** The clinic calendar connection (the Owner's account). */
async function getAccount() {
  return db.googleAccount.findFirst({ where: { user: { role: "OWNER" } }, orderBy: { createdAt: "asc" } });
}

async function accessToken(): Promise<{ token: string; calendarId: string } | null> {
  const account = await getAccount();
  if (!account || !googleConfigured()) return null;
  if (account.expiresAt.getTime() - 60_000 > Date.now()) {
    return { token: decrypt(account.accessTokenEnc), calendarId: account.calendarId };
  }
  const refresh = decryptOptional(account.refreshTokenEnc);
  if (!refresh) return null;
  const tokens = await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });
  await db.googleAccount.update({
    where: { id: account.id },
    data: { accessTokenEnc: encrypt(tokens.access_token), expiresAt: new Date(Date.now() + tokens.expires_in * 1000) },
  });
  return { token: tokens.access_token, calendarId: account.calendarId };
}

async function gfetch(path: string, init: RequestInit & { token: string }) {
  const res = await fetch(`${CAL_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${init.token}`, "Content-Type": "application/json" },
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Google Calendar API error ${res.status}`);
  return res.status === 204 ? null : res.json();
}

function eventBody(appt: {
  id: string;
  startAt: Date;
  endAt: Date;
  status: string;
  lead: { firstName: string; lastName: string | null };
  consultationType: { name: string };
}) {
  const initial = appt.lead.lastName ? ` ${appt.lead.lastName[0]}.` : "";
  return {
    summary: `[CM101] ${appt.lead.firstName}${initial} – ${appt.consultationType.name}`,
    description: `Status: ${appt.status}. Open the clinic system for details.`,
    start: { dateTime: appt.startAt.toISOString(), timeZone: "Asia/Manila" },
    end: { dateTime: appt.endAt.toISOString(), timeZone: "Asia/Manila" },
    extendedProperties: { private: { [APP_TAG]: appt.id } },
  };
}

/** Create, update or delete the Google event for one appointment. Fails quietly if Google isn't connected. */
export async function pushAppointment(appointmentId: string): Promise<void> {
  const auth = await accessToken().catch(() => null);
  if (!auth) return;
  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { lead: true, consultationType: true },
  });
  if (!appt) return;
  const cal = encodeURIComponent(auth.calendarId);

  try {
    if (["CANCELLED", "RESCHEDULED"].includes(appt.status)) {
      if (appt.googleEventId) {
        await gfetch(`/calendars/${cal}/events/${appt.googleEventId}`, { method: "DELETE", token: auth.token });
        await db.appointment.update({ where: { id: appt.id }, data: { googleEventId: null } });
      }
      return;
    }
    const body = JSON.stringify(eventBody(appt));
    if (appt.googleEventId) {
      const updated = await gfetch(`/calendars/${cal}/events/${appt.googleEventId}`, { method: "PUT", body, token: auth.token });
      if (updated) return;
    }
    const created = await gfetch(`/calendars/${cal}/events`, { method: "POST", body, token: auth.token });
    if (created?.id) await db.appointment.update({ where: { id: appt.id }, data: { googleEventId: created.id } });
  } catch (err) {
    console.error("Google push failed for appointment", appt.id, (err as Error).message);
  }
}

type GEvent = {
  id: string;
  status: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  transparency?: string;
  extendedProperties?: { private?: Record<string, string> };
};

function eventTimes(e: GEvent): { startAt: Date; endAt: Date } | null {
  const s = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00+08:00` : null);
  const en = e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00+08:00` : null);
  return s && en ? { startAt: new Date(s), endAt: new Date(en) } : null;
}

/**
 * Pull from Google: doctor's own events become busy time (blocks booking), and clinic events
 * moved or deleted in Google update the matching appointment.
 */
export async function pullFromGoogle(): Promise<{ busy: number; updated: number } | null> {
  const auth = await accessToken();
  if (!auth) return null;
  const cal = encodeURIComponent(auth.calendarId);
  const timeMin = new Date();
  const timeMax = new Date(Date.now() + SYNC_DAYS_AHEAD * 86_400_000);

  const events: GEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "250",
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await gfetch(`/calendars/${cal}/events?${params}`, { method: "GET", token: auth.token });
    events.push(...(page?.items ?? []));
    pageToken = page?.nextPageToken;
  } while (pageToken);

  let updated = 0;
  const busyIds: string[] = [];
  for (const e of events) {
    const apptId = e.extendedProperties?.private?.[APP_TAG];
    const times = eventTimes(e);
    if (apptId) {
      const appt = await db.appointment.findUnique({ where: { id: apptId } });
      if (!appt || ["CANCELLED", "RESCHEDULED", "ATTENDED", "NO_SHOW"].includes(appt.status)) continue;
      if (e.status === "cancelled") {
        await db.appointment.update({ where: { id: apptId }, data: { status: "CANCELLED", googleEventId: null } });
        updated++;
      } else if (times && (times.startAt.getTime() !== appt.startAt.getTime() || times.endAt.getTime() !== appt.endAt.getTime())) {
        await db.appointment.update({ where: { id: apptId }, data: times });
        updated++;
      }
      continue;
    }
    if (e.status === "cancelled" || e.transparency === "transparent" || !times) continue;
    busyIds.push(e.id);
    await db.externalBusy.upsert({
      where: { googleEventId: e.id },
      create: { googleEventId: e.id, ...times, summary: e.summary?.slice(0, 120) },
      update: { ...times, summary: e.summary?.slice(0, 120) },
    });
  }
  await db.externalBusy.deleteMany({ where: { googleEventId: { notIn: busyIds } } });
  await db.googleAccount.updateMany({ data: { lastSyncAt: new Date() } });
  return { busy: busyIds.length, updated };
}
