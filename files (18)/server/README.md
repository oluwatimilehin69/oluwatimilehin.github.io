# SI Academy — Backend

Real auth, enrollment, and Paystack payments for the SI Academy pages.
This replaces the earlier browser-storage demo: student accounts,
purchases and lesson progress now live in a real database, and course
access is only unlocked once Paystack confirms payment — never
because the browser said so.

## What's here

- `server.js` — Express app and all routes
- `db.js` — SQLite (via better-sqlite3), stored in `academy.db` (created automatically)
- `courses-data.js` — course catalog and **prices** (the single source of truth — the frontend just displays this, it can't set its own price)
- `paystack.js` — calls to Paystack's API, plus webhook signature verification
- `auth.js` — JWT sign/verify + an `requireAuth` middleware

## Setup

1. `npm install`
2. `cp .env.example .env` and fill it in:
   - `PAYSTACK_SECRET_KEY` — from your Paystack dashboard (Settings → API Keys & Webhooks). Use the `sk_test_...` key while building.
   - `JWT_SECRET` — any long random string. Generate one with:
     ```
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
   - `CLIENT_URL` — where the static frontend (the `si-photography-site` files) is served from, e.g. `http://localhost:5500` locally, or your real domain once deployed. Paystack redirects the customer back here after payment, and this is the only origin the API accepts requests from.
   - `PORT` — defaults to 4000.
3. `npm start` (or `npm run dev` to auto-restart on changes).

## Wiring up the frontend

In `academy.js` on the frontend, set:
```js
const API_BASE = 'http://localhost:4000/api'; // or your deployed backend URL
```
That's the only thing that needs to change to point the static site at this backend.

## Configuring the Paystack webhook

The webhook is the authoritative confirmation of payment — it's what
actually grants access, not the browser redirect. In your Paystack
dashboard:

1. Settings → API Keys & Webhooks → Webhook URL
2. Set it to `https://your-backend-domain.com/api/webhooks/paystack`
3. Test mode and live mode have **separate** webhook URLs — set both once you deploy each.

Paystack requires this URL to be publicly reachable, so it won't work
pointed at `localhost`. To test webhooks locally, tunnel your local
server with something like `ngrok http 4000` and use the tunnel URL.

## How a purchase actually gets confirmed

1. Frontend calls `POST /api/courses/:slug/checkout` → backend asks Paystack
   to initialize a transaction (using the **server-side** price, so a
   tampered client can't pay less) and returns `authorization_url`.
2. Frontend redirects the browser to `authorization_url` — Paystack's own
   hosted checkout collects the card details. This backend and frontend
   never see or store card numbers, which keeps you out of PCI scope.
3. Paystack redirects back to `academy-payment-callback.html`, which calls
   `GET /api/payments/verify/:reference` for immediate on-screen feedback.
4. Independently, Paystack calls the webhook (`POST /api/webhooks/paystack`)
   with a `charge.success` event. The backend verifies the signature,
   double-checks the amount, and unlocks the course. This step is what
   actually matters — it fires even if the customer closes their browser
   right after paying, before step 3 can run.

Both paths write to the same `enrollments` table and are idempotent, so
whichever arrives first "wins" and the second is a no-op.

## Test card numbers

Paystack's test mode accepts, among others:
- `4084 0840 8408 4081`, any future expiry, CVV `408`, OTP `123456`

See Paystack's own documentation for the current full list — test
card behavior can change.

## Deploying

This needs a **persistent Node process** and writes to a local SQLite
file, so it won't run on a static host (Netlify, GitHub Pages, etc. are
for the frontend only). Reasonable options: Render, Railway, or Fly.io
all have small always-on tiers that work well for this. Keep the
frontend on whatever static host you like — just point `API_BASE` in
`academy.js` at wherever this backend ends up.

If you outgrow a single SQLite file (e.g. you move to a host with an
ephemeral filesystem, or want multiple server instances), swap `db.js`
for a hosted Postgres/MySQL database — the rest of the app talks to
`db.js`'s exported functions, not to SQLite directly, so that's a
contained change.

## Going to production

- Switch `PAYSTACK_SECRET_KEY` to your `sk_live_...` key, and set the
  **live** webhook URL in the Paystack dashboard.
- Set `CLIENT_URL` to your real domain.
- Never commit `.env`.
