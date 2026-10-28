# Clinica Medica 101 — Clinic Operating System

Patient acquisition and retention system for Clinica Medica 101 Center for Complementary Medicine
(Centuria Medical Makati): inquiries → booking → consultation → treatment → follow-up → measurement.

Mobile-first web app. One doctor/owner today, with roles ready for staff (Owner, Doctor, Front desk).

## Status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Plan: data model, screens, Meta/Google setup | Done |
| 1 | Login + roles + 2FA, leads pipeline, saved Taglish scripts, booking calendar, Google Calendar sync | **Done** |
| 2 | Messenger webhook: auto-replies, quick replies, booking flow, human takeover, reminders | Next |
| 3 | Patient intake + pre-consult form, assessment notes, treatment plan + consent, session log | |
| 4 | Follow-up/recall, progress tracking, feedback, payments, receivables, receipts | |
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
