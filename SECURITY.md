# Security notes

## Singletons and their limits

| Module | Why shared | Lifecycle / limits |
| --- | --- | --- |
| `src/lib/db.ts` (Mongoose) | One connection pool per process instead of one per request; concurrent callers share the in-flight promise; a failed attempt clears it so the next call retries. Cached on `globalThis` to survive dev hot reloads. | Per process. Every serverless instance/replica has its own pool (size 10). Provides no locking or cross-instance state. |
| `src/lib/cloudinary.ts` | The SDK keeps configuration in module state; configure once. | Holds credentials only, no per-user state. |
| `src/lib/email/transport.ts` | Pooled SMTP connections reused between messages. | Per process; provider can be swapped by implementing `MailTransport`. |

No singleton ever stores the current user, session or permissions. These are resolved per request
(`getSessionUserFromToken`, React `cache()` scoped to one render). Anything that must be correct across
instances is in MongoDB: unique indexes, conditional/atomic updates, transactions, the rate-limit
collection, the email outbox and the asset-deletion queue.

## Authentication & sessions
- Passwords: scrypt (N=2¹⁵, r=8, p=3, 16-byte salt), parameters encoded in the hash.
- Sessions: HS256 JWT (issuer/audience/expiry checked) in an `HttpOnly`, `SameSite=Lax` cookie,
  `Secure` + `__Host-` prefix in production. Every request re-loads the user and compares
  `sessionVersion`, so password changes, resets, "sign out everywhere" and teacher password
  rotation revoke existing sessions immediately.
- Brute force: MongoDB-backed rate limits per IP and per account; 10 wrong passwords lock the account
  for 15 minutes; generic "incorrect email or password" message; dummy hash on unknown emails.
- Email verification / reset tokens: 256-bit CSPRNG tokens, only SHA-256 hashes stored, single use
  (atomic `findOneAndUpdate`), expiry (24 h / 30 min), previous tokens invalidated on re-issue,
  TTL index cleanup. Token pages send `Referrer-Policy: no-referrer`, load no third-party resources,
  and strip the token from the address bar.
- Registration/resend/forgot responses don't reveal whether an email exists. A registration attempt
  on an existing verified email notifies the owner instead.

## Authorization
- Deny by default: every API route declares `auth: "none" | "student" | "teacher" | "any"`; every
  teacher page is guarded server-side (404 for other roles). `proxy.ts` redirects are only a UX
  shortcut.
- Paid lesson content (descriptions, videos, files) is loaded only after a server-side check for an
  **approved** enrollment. Public pages show lesson titles only.
- Chat: a student can only access their own conversation (checked on every read and send).
- Students cannot reach any teacher route, including approval.

## Lesson videos (YouTube)
- Lesson videos are hosted on the platform's YouTube channel; teachers paste a link. The server
  accepts only links on recognised YouTube hosts and stores just the extracted 11-character video ID
  (`src/lib/youtube.ts`). A video ID sent by the browser is never trusted.
- Students watch through the privacy-enhanced `youtube-nocookie.com` embed (IFrame Player API),
  inside the learning page. YouTube's branding and controls stay visible; nothing is overlaid on them.
- **Limitation:** an *Unlisted* YouTube video can be watched by anyone who has its link or video ID,
  and a student who opens the page can see that ID. Enrollment checks protect the lesson list,
  descriptions, resources and progress, **not the video itself**. Embedding doesn't prevent screen
  recording or downloading either. If videos must stay confidential, YouTube embedding is not enough.
- Progress is reported by the browser. The server clamps watch time to what real playback at ≤2×
  speed could produce, so a crafted request can't complete a lesson instantly, but a determined
  student can still fake slow heartbeats. Treat progress as a learning aid, not an exam record.
- Legacy Cloudinary videos (from before YouTube hosting) still play through `/api/media/<lesson>`
  until the teacher sets a YouTube link, which deletes the old file. New video uploads are refused.

## Paid media delivery (Cloudinary)
- Documents (and legacy videos) are uploaded with delivery type **`authenticated`**, so their plain URLs
  return 401. Thumbnails are public.
- Resource files are checked by content, not only by extension: after upload, the server reads the
  first bytes and checks the file signature (PDF, Office/ZIP, OLE, RTF, plain text).
- External link resources (https only) are handed out through the same enrollment-checked redirect.
- Documents/PDFs/slides: `/api/media/<lesson>/<resource>` checks enrollment, then redirects to a
  Cloudinary **private download URL whose signature includes `expires_at` (10 minutes)**.
- Legacy videos: `/api/media/<lesson>` checks enrollment, then redirects to a **signed delivery URL**.
  **Limitation:** Cloudinary's standard signed URLs don't expire. A student who copies the final
  CDN URL out of the network inspector can keep using it. To get real expiry, enable Cloudinary
  *token-based authentication* (an add-on/enterprise feature) and set `CLOUDINARY_AUTH_TOKEN_KEY`;
  URLs are then valid for 2 hours. Replacing a video gives it a new `public_id`, which effectively
  revokes old links.
- Uploads: teacher-only signatures with server-chosen `public_id`; type/size validated before signing;
  completion re-verifies the asset with the Admin API and must match an unconsumed `UploadIntent`;
  rejected uploads are deleted. Old assets are deleted only after the DB points to the replacement.

## Web/API hardening
- Zod schemas on every request body (strings only, which blocks `{"$ne": …}` operator injection;
  unknown keys stripped, so no mass assignment); explicit field allow-lists on updates.
- CSRF: `SameSite=Lax` cookies + `Origin`/`Sec-Fetch-Site` check on all mutations + required JSON
  content type.
- CSP with per-request nonce and `strict-dynamic` (`src/proxy.ts`); `frame-ancestors 'none'`,
  `object-src 'none'`, `nosniff`, `X-Frame-Options`, `Permissions-Policy`, HSTS in production.
- JSON body limit 16 KB by default; uploads never pass through the app server.
- Chat messages are stored as text and rendered by React (escaped), never as HTML.
- Login `next` parameter accepts only same-site relative paths (no open redirects).
- Errors: users get generic messages; logs are structured JSON with passwords, tokens, secrets,
  signatures and connection-string credentials redacted.

## Payment integrity
Amount comes from the course document; transaction IDs are normalised and unique among active
(pending/approved) enrollments; approve/reject are conditional, idempotent transitions recorded in
the audit log. The shared teacher account means audit entries **cannot identify which teacher acted**.

## Operations
- Keep `.env.local` out of git (it is ignored). Use a least-privilege Atlas user (`readWrite` on the
  app database only).
- **Rotating secrets:** `JWT_SECRET` (signs everyone out), Atlas user password (update
  `MONGODB_URI`), SMTP app password, Cloudinary API secret (Cloudinary console → regenerate),
  `CRON_SECRET`, teacher password (`seed:teacher -- --rotate-password`). Redeploy after each change.
- Monitor `auth.login_failed`, `auth.login_locked`, `auth.verify_failed` and `media.denied` entries in
  the audit log, and the *Email log* for dead messages.
- There are no debug endpoints. `/api/health` reports only booleans.
