# SMS Gateway — Web Panel

Next.js control panel for the self-hosted SMS gateway. Manage API keys and
devices, send single/bulk/scheduled SMS, and view message history. It also
serves the phone-facing API that the Android app polls.

Backed by [PocketBase](https://pocketbase.io) (SQLite + REST + auth).

## Getting started

1. **Run PocketBase** (from the sibling `pocketbase/` folder). Migrations in
   `pb_migrations/` create the `api_keys`, `devices`, and `messages`
   collections automatically:

   ```bash
   ./pocketbase serve
   ```

2. **Create a superuser** matching your env (deploy-time method):

   ```bash
   ./pocketbase superuser upsert admin@example.com <strong-password>
   ```

3. **Configure the panel.** Copy `.env.example` to `.env.local` and set the
   PocketBase URL + the same superuser credentials.

4. **Run the panel:**

   ```bash
   npm install
   npm run dev
   ```

   Open <http://localhost:3000>. Register an account, create an API key, then
   scan its QR in the Android app to connect a phone.

## Environment

| Variable                   | Purpose                                                        |
| -------------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_PB_URL`       | PocketBase URL. Used by the browser SDK **and** server code.   |
| `POCKETBASE_ADMIN_EMAIL`   | Superuser email — server-only, used by the phone API routes.   |
| `POCKETBASE_ADMIN_PASSWORD`| Superuser password — server-only.                              |

## Architecture

- **User auth** (panel): PocketBase `users` via the browser SDK. A React
  `AuthProvider` (`context/auth-context.tsx`) exposes `useAuth()`; the dashboard
  is gated by `components/ProtectedRoute.tsx`.
- **Phone auth** (API routes): `Authorization: Bearer <api-key>`. Route handlers
  resolve the key to an `api_keys` record using a server-only superuser client
  (`lib/pb-admin.ts`).

## Phone API (bearer-token auth)

The Android app calls these at `<host>/…` where `<host>` comes from the QR code.

| Method + path | Body / result                                                     |
| ------------- | ----------------------------------------------------------------- |
| `GET /outgoing`  | → `[{ id, to, body, sim }]`. Claims each returned message as `sending` (so overlapping polls don't double-send), promotes due scheduled messages, updates `last_seen`, and honors each device's `rate_limit_per_min`. |
| `POST /status`   | `{ id, status: "sent"\|"failed", error? }` — reports a send result. |
| `POST /incoming` | `{ from, body, sim, timestamp }` — stores a received SMS.        |
| `POST /register` | `{ devices: [{ sim_slot, subscription_id, carrier, number }] }` — upserts the phone's SIMs. |

## Message lifecycle

`pending` → (`GET /outgoing` claims it) `sending` → (`POST /status`) `sent` /
`failed`. Scheduled sends start as `scheduled` with a `send_at`, and are
promoted to `pending` on the first poll after they're due. Incoming SMS are
stored as `received`.
