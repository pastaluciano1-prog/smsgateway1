# SMS Gateway

Turn an Android phone into a self-hosted SMS gateway, driven by a web panel.
Queue single, bulk, or scheduled messages from the browser; the phone polls the
server, sends them over its own SIM(s), and reports back. Incoming SMS are
forwarded to the panel too.

No third-party SMS provider, no Firebase/push, no Play Store — you host the
backend yourself and install the app directly.

## How it works

```
┌──────────────┐        HTTPS         ┌──────────────┐      REST/SDK     ┌──────────────┐
│  Web panel   │  ───────────────▶    │  Next.js API  │  ─────────────▶  │  PocketBase  │
│  (browser)   │   auth, queue SMS    │  (the panel)  │   data + auth    │  (SQLite)    │
└──────────────┘                      └──────────────┘                   └──────────────┘
                                            ▲
                                            │  poll /outgoing, POST /status, /incoming
                                            │  (Authorization: Bearer <api-key>)
                                      ┌──────────────┐
                                      │  Android app │  sends/receives SMS over the SIM
                                      └──────────────┘
```

- **Interval polling** (no push): the phone asks the server "anything to send?"
  every few seconds. Works through mobile NAT.
- **Bearer-token auth** for the phone; **PocketBase user auth** for the panel.
- Message lifecycle: `pending` → (claimed by `/outgoing`) `sending` →
  (`/status`) `sent`/`failed`. Scheduled messages start `scheduled` and are
  released when due. Incoming SMS are stored as `received`.

## Repository layout

| Folder | What it is |
| ------ | ---------- |
| [`smsgateway-panel/`](smsgateway-panel) | Next.js web panel + the phone-facing API routes. |
| [`pocketbase/`](pocketbase) | PocketBase config. `pb_migrations/` holds the schema (auto-applied on start). |
| [`smsgateway-app/`](smsgateway-app) | The Android app (React Native / Expo prebuild) + native SMS module. |

## Quick start (local)

**1. Backend + panel** — with Docker:

```bash
cp .env.example .env      # set a strong POCKETBASE_ADMIN_PASSWORD
docker compose up -d --build
```

- Panel → http://localhost:3000
- PocketBase admin → http://localhost:8090/_/

Or run them without Docker: start `pocketbase serve` in `pocketbase/`, then
`npm install && npm run dev` in `smsgateway-panel/` (see
[`smsgateway-panel/README.md`](smsgateway-panel/README.md)).

**2. The phone**

- Install the APK from **[Releases](../../releases)**, or build it yourself
  (see [`smsgateway-app/BUILD_APK.md`](smsgateway-app/BUILD_APK.md)).
- In the panel: register → create an API key → **Generate QR**.
- Scan the QR in the app, grant SMS + phone permissions. Done.

> The QR's "Panel URL" must be reachable from the phone — your public panel URL
> in production, or your PC's LAN IP (not `localhost`) for local testing.

## Deploying

See [`DEPLOY.md`](DEPLOY.md) for Docker Compose (any VPS), Railway, and
DigitalOcean instructions, plus the full environment-variable reference.

The short version: expose the **panel** and **PocketBase** publicly (ideally
behind HTTPS), set `NEXT_PUBLIC_PB_URL` to the public PocketBase URL at build
time, and point the QR at the public panel URL.

## The phone API (bearer-token)

The app calls these at `<panel-url>/…`:

| Endpoint | Purpose |
| -------- | ------- |
| `GET /outgoing` | Returns queued messages `[{ id, to, body, sim }]`, honoring per-SIM rate limits. |
| `POST /status` | Reports a send result: `{ id, status: "sent"\|"failed", error? }`. |
| `POST /incoming` | Stores a received SMS: `{ from, body, sim, timestamp }`. |
| `POST /register` | Upserts the phone's SIMs so the panel can target them. |

## Notes & limitations

- Because there's no push, the app must keep a foreground service alive and be
  exempt from battery optimization, or Android will kill the poll loop.
- A SIM's phone number is often blank (carrier/privacy); SIM slot + carrier are
  reliable, the number may need manual entry.
- Distribute the APK directly — `SEND_SMS`/`RECEIVE_SMS` are restricted on the
  Play Store.

## Building the APK

See [`smsgateway-app/BUILD_APK.md`](smsgateway-app/BUILD_APK.md) — icon setup,
signing keystore, and the Gradle release build. Keep your `release.keystore`
safe; it's required to ship updates and is intentionally not committed.
