# Clinica Medica 101 — Clinic Operating System

Patient acquisition and retention system for Clinica Medica 101 Center for Complementary Medicine
(Centuria Medical Makati): inquiries → booking → consultation → treatment → follow-up → measurement.

Mobile-first web app. One doctor/owner today, with roles ready for staff (Owner, Doctor, Front desk).

## Status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Plan: data model, screens, Meta/Google setup | Done |
| 1 | Login + roles + 2FA, leads pipeline, saved Taglish scripts, booking calendar, Google Calendar sync | **Done** |
| 2 | Messenger webhook: auto-replies, quick replies, booking flow, human takeover, reminders | **Done** |
| 3 | Patient intake + pre-consult form, assessment notes, treatment plan + consent, session log | **Done** |
| 4 | Follow-up/recall, progress tracking, feedback, payments, receivables, receipts | **Done** |
| 5 | Weekly dashboard, Monday email, CSV/Sheets export, audit log screen, optional AI assistant | |
| 6 | Deployment, backup/restore, Taglish SOPs | |

## Run it locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env      # then fill AUTH_SECRET, ENCRYPTION_KEY, CRON_SECRET (see comments in the file)
npm run db:push           # create the local SQLite database
npm run db:seed           # load FAKE demo data (wipes the local database)
npm run dev               # http://localhost:3000
```

Demo logins (fake data only): `owner@example.com` and `frontdesk@example.com`, password `ChangeMe-Clinic-2026`
(override with `SEED_OWNER_PASSWORD`). The owner is asked to set up 2FA with an authenticator app on first login.

```bash
npm test                  # unit tests
npm run typecheck
```

## Tech

Next.js 15 (App Router) + TypeScript, Tailwind CSS, Prisma (SQLite in dev, PostgreSQL in production),
Auth.js credentials + TOTP 2FA, bcrypt. Timezone Asia/Manila, currency PHP.

## Privacy and security (Data Privacy Act, RA 10173)

- Health information (e.g. a lead's health concern) is encrypted at rest with AES-256-GCM (`ENCRYPTION_KEY`).
- Roles: Front desk can manage inquiries and bookings but never sees health information.
- Owner must use 2FA. Accounts lock for 15 minutes after 5 failed logins.
- Audit log records logins, views and edits of lead and appointment records (no health data in log details).
- Google Calendar receives only first name + last initial, time, and consultation type.
- All secrets live in environment variables. Never commit `.env`. Seed data is fake.

## Google Calendar sync

Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (OAuth client, redirect URI `{APP_URL}/api/google/callback`),
then Settings → Google Calendar → Connect. Bookings push to Google immediately. Your own Google events
block those times from booking, and clinic events moved/deleted in Google update the appointment.
In production, call `GET /api/cron/google-sync` with header `Authorization: Bearer $CRON_SECRET` every 10–15 minutes.

## Messenger automation (Phase 2)

- Webhook: `{APP_URL}/api/webhooks/messenger` (verify token = `META_VERIFY_TOKEN`; every POST is checked against
  `X-Hub-Signature-256` with `META_APP_SECRET`). Subscribe the Page to `messages`, `messaging_postbacks`,
  `messaging_referrals`, `message_echoes`.
- New conversations create a lead automatically. `m.me/<page>?ref=<tracking code>` links tag the lead's campaign.
- Quick-reply menu: Paano ang consult?, Magkano ang fee?, Available schedule, Location, Mag-book, Kausapin ang doktor
  (Messenger caps button titles at 20 characters).
- Booking flow: privacy consent → consultation type → open slot → full name → mobile → booked + confirmation.
- Anything that looks medical or that the bot doesn't understand is never answered: the patient gets a safe hand-off
  reply, the conversation goes to **Inbox → Needs doctor reply**, and the doctor gets an email (no patient details).
- Human takeover: replying from the clinic inbox, or from the Facebook Page inbox, pauses the bot for that conversation.
- Reminders (`GET /api/cron/reminders` every 15 min with the cron secret): confirmation, day before, day of, plus
  automatic no-show detection and a re-booking message. Channel order: Messenger within 24h → Messenger utility
  template → email (clinic Gmail) → SMS (Semaphore, when `SEMAPHORE_API_KEY` is set). No messages between 8pm and 8am.
- Meta retired the CONFIRMED_EVENT_UPDATE tag on Feb 10, 2026. Reminders outside 24h use a UTILITY template
  (Settings → Messenger → "Create template on Meta"; needs the `page_utility_messaging` permission).
- Message text is encrypted at rest. Front desk cannot open Messenger conversations (they may contain health details).

## Consultation & treatment (Phase 3)

- **Convert lead → patient** from the lead page (no re-typing); patients get numbers like `CM-0001`.
- **Pre-consult form**: "Send intake form" creates a one-time link (valid 7 days) at `/intake/<token>`, optionally sent
  via Messenger. It collects demographics, chief complaint, history, medications, allergies, lifestyle, prior
  treatments and goals, and requires Data Privacy Act consent. Answers are encrypted; only the doctor/owner see them.
- **Assessments**: chief complaint (pre-filled from the form), symptoms, exam findings, investigations, results,
  findings explained, plus result uploads (PDF/images, 10 MB each), encrypted on disk in `UPLOAD_DIR`.
- **Treatment plans**: modalities × sessions × price with a live total, schedule, benefits, risks, alternatives.
  Status flow Draft → Proposed → Accepted → Started → Completed (or Declined/Cancelled). A plan **cannot be Started
  without a recorded informed consent** (date, explained by, acknowledgement, optional signed-form upload).
  Accepted plans are locked; changes mean a new plan.
- **Session log** per visit with progress notes.
- **Printable plan + cost estimate** for the patient at `/print/plans/<id>` (browser Print → Save as PDF). It never
  includes assessment notes.
- Front desk sees patient demographics and appointments only; clinical tabs, files and print pages are blocked.

## Follow-up & billing (Phase 4)

**Follow-up** (`/followups`, and the Follow-up tab on each patient)
- Follow-up schedule per patient: next session, reassessment, or check-in, with a due date. Logging a session can set the next date in the same form.
- Automatic reminders (run by the same `/api/cron/reminders` job, 9 AM–6 PM only): the day before or on the due date, then weekly while overdue, up to 3 times. Patients with a booking are skipped. A visit (attended appointment or logged session) closes follow-ups due up to a week later.
- **Missed sessions**: a started plan with no session for 14 days and nothing booked gets one reminder per gap.
- **Recall list**: patients with no visit for 90 days and nothing booked; "Send recall" sends the `recall_inactive` script and creates a check-in follow-up.
- Channel order for these: Messenger (within 24h) → email → SMS. Meta utility templates are used only for appointment reminders.
- All timings are in More → Follow-up & billing settings.

**Progress** (Progress tab, clinical roles only): a 0–10 rating of the main complaint per visit, entered on its own or when logging a session, shown as a trend chart plus a table.

**Feedback**: after an attended consultation the patient gets a one-time link (`/feedback/<token>`, 14 days) with a 1–5 rating, comment, and an optional testimonial consent with how they want to be named. Comments are encrypted and only Owner/Doctor can read them. The owner can stop using any testimonial.

**Billing** (Billing tab on each patient, and `/billing`)
- Charges per visit (one click from an attended appointment, or per session from the session log), and prepaid **packages** whose sessions are used up from the session log.
- Payments: Cash, GCash, Maya, Credit card (reference number required for non-cash), optional BIR official receipt number. Partial payments and advance payments work; payments are applied to the oldest unpaid charge first.
- Printable **acknowledgement receipt** (AR-YYYY-00001), with amount in words. It is not a BIR official receipt.
- Reports: daily collections (front desk can see), receivables per patient with 0-30 / 31-60 / 61-90 / 90+ aging, and a monthly report compared with the previous month (Owner/Doctor).
- Only the Owner can void a payment or charge, with a reason; voids stay visible.
- Amounts are whole pesos.
