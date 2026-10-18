# Onkuron (অঙ্কুরণ) LMS

A course platform with video lessons, downloadable materials, manual mobile-banking
payment verification, student ↔ teacher messaging and transactional email.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 ·
MongoDB Atlas + Mongoose 9 · Cloudinary · Nodemailer (SMTP) · Zod · jose (JWT) · Vitest.

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in the values (see below)
npm run check:env -- --smtp --cloudinary   # verifies config without printing secrets
npm run seed:teacher            # creates the shared teacher account (idempotent)
npm run dev                     # http://localhost:3000
```

Optional development data (clearly labelled “[Demo]”, no students or payments; refuses to run in production):

```bash
npm run seed:demo -- --publish  # add demo courses
npm run seed:demo -- --remove   # delete them again
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run lint` · `npm run typecheck` · `npm test` | ESLint, `tsc`, Vitest (in-memory MongoDB) |
| `npm run check:env [-- --smtp --cloudinary --send-test you@x.com]` | Check configuration and connectivity |
| `npm run seed:teacher [-- --rotate-password]` | Provision the teacher, or rotate its password |
| `npm run worker:email [-- --once]` | Email outbox + Cloudinary cleanup worker |

## Configuration

| Feature | Required variables | Without them |
| --- | --- | --- |
| Database | `MONGODB_URI`, `MONGODB_DB_NAME` | App can't start pages |
| Sessions & links | `JWT_SECRET` (≥32 chars), `APP_URL` | Login/registration fail |
| Email | `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Registration returns 503 (“email not configured”); notifications wait in the outbox |
| Uploads & paid media | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Upload UI hidden, media routes return 503 |
| Teacher seeding | `TEACHER_EMAIL`, `TEACHER_PASSWORD` | `seed:teacher` fails with a clear message |
| Cron endpoint | `CRON_SECRET` | `/api/internal/jobs` rejects all calls |

`.env.local` is git-ignored. Values containing `#` or spaces must be quoted
(unquoted `#` starts a comment).

### MongoDB Atlas

1. **Network access:** add your server's egress IPs (or `0.0.0.0/0` only temporarily for development).
2. **Database user:** create a user with the built-in role **readWrite on `onkurlms` only**
   (not `atlasAdmin`). The app creates its own indexes on startup, which `readWrite` allows.
3. **Backups:** enable Atlas Cloud Backup (continuous / point-in-time on M10+, snapshots on
   shared tiers) and test a restore into a separate database periodically.

### Gmail SMTP

Use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER=<your Gmail
address>` and an **App Password** (Google Account → Security → 2-Step Verification → App
passwords) as `SMTP_PASS`. For production volume use a transactional provider (SES, Postmark,
Brevo…) — only the SMTP variables change.

### Cloudinary

Copy *Cloud name*, *API key* and *API secret* from the Cloudinary console (Settings → API Keys).
If the free plan blocks PDF delivery, enable **Settings → Security → “Allow delivery of PDF and
ZIP files”**; PDFs here are stored as `raw` files, which this setting doesn't normally affect.

## How it works

### Accounts
- **Students** register (name, email, phone, password) → account is created *unverified* → a
  single-use link is emailed. Opening `/verify-email?token=…` only shows a confirmation button;
  the token is consumed by a `POST`, so mail scanners and link previews can't burn it.
  Unverified users cannot log in, enroll, chat or access content.
- **Teacher**: one shared account (`TEACHER_EMAIL`/`TEACHER_PASSWORD`) for all teachers.
  Created by `npm run seed:teacher` (atomic upsert; never resets an existing password; a unique
  partial index guarantees only one teacher). Alternatively set `SEED_INITIAL_TEACHER=true` for
  a one-time bootstrap on first DB connection, then set it back to `false`.
  **Rotate the password** either in *Teacher → Settings* (requires the current password) or by
  updating `TEACHER_PASSWORD` and running `npm run seed:teacher -- --rotate-password`. Both
  sign out every teacher session.

### Enrollment & payment
1. Teacher sets bKash/Nagad/Rocket receiving numbers in *Settings*.
2. Student pays, then submits method + transaction ID + sender number. The amount is taken
   from the course in MongoDB. The enrollment is **pending**; an email confirms the
   submission and says the payment is *not yet verified*.
3. The teacher checks the transaction in their wallet and **approves** or **rejects** (with a
   reason). Transitions are conditional updates inside a transaction, so they're idempotent;
   the student receives one approval/rejection email.

Payments are never verified automatically.

### Email delivery (outbox)
Notification emails (verified, enrollment submitted/approved/rejected, password changed,
registration attempt) are written to the `emailoutboxes` collection **in the same transaction**
as the state change, keyed by an idempotency key (e.g. `enrollment:<id>:approved`).
Delivery is attempted right after the response (`after()`); failures are retried with
exponential backoff (30 s → 1 h, 6 attempts), and permanent SMTP 5xx errors are marked *dead*.
*Teacher → Email log* shows status/errors and has **Retry now** / **Process queue now**.

Verification and password-reset emails are sent synchronously instead, because they contain
a raw single-use token that must never be stored. If sending fails the user is told so and can
use “Resend”.

**Run a worker in production** so retries happen without anyone visiting the site:
- long-running host: `npm run worker:email` (e.g. under systemd/pm2), or
- serverless (e.g. Vercel): schedule `GET /api/internal/jobs` with header
  `Authorization: Bearer $CRON_SECRET` every few minutes.

Without a worker, first attempts still happen immediately; failed ones wait until the next
worker run, cron call, or manual retry. “Sent” means the SMTP server accepted the message, not
that it reached the inbox.

### Media
Teachers upload directly from the browser to Cloudinary using a server-generated signature
(server-chosen `public_id`, chunked for files > 20 MB, with progress). The server then
re-reads the asset from the Cloudinary Admin API and only stores trusted metadata. Replaced or
removed assets are deleted from Cloudinary after the database no longer references them
(durable `assetdeletions` queue). See [SECURITY.md](SECURITY.md) for delivery protection.

## Project layout

```
src/
  app/                 pages (student, teacher, auth) and API route handlers (app/api/**)
  components/          UI components (teacher/ = course editor, uploader)
  lib/                 env validation, db/cloudinary/email singletons, auth, security, logger
  models/              Mongoose schemas and indexes
  services/            business logic (auth, enrollment, uploads, chat, seeding, assets)
  proxy.ts             CSP nonce + optimistic auth redirects
scripts/               seed, worker and environment-check CLIs
tests/                 Vitest suites (mongodb-memory-server, fake SMTP, mocked Cloudinary)
```
