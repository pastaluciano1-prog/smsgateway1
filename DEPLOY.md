# Deploying the SMS Gateway

Two services: **PocketBase** (database + auth) and the **Next.js panel** (UI +
the API the phone polls). Both ship as Docker images.

## Option A — Docker Compose (any VPS: DigitalOcean droplet, Hetzner, etc.)

1. Clone the repo onto the host.
2. Configure env:
   ```bash
   cp .env.example .env
   # edit .env — set a strong POCKETBASE_ADMIN_PASSWORD, and set
   # NEXT_PUBLIC_PB_URL to the PUBLIC URL your users' browsers use for PocketBase.
   ```
3. Bring it up:
   ```bash
   docker compose up -d --build
   ```

- Panel → `http://<host>:3000`
- PocketBase → `http://<host>:8090` (admin UI at `/_/`)
- Collections are created automatically on first boot (from `pocketbase/pb_migrations/`).
- The superuser is created from your env vars on first boot.

**Data** lives in the `pb_data` Docker volume — back that up.

### Production notes
- Put a reverse proxy (Caddy/Nginx/Traefik) in front for HTTPS. Point one domain
  at the panel (`:3000`) and one at PocketBase (`:8090`), e.g.
  `panel.example.com` and `pb.example.com`.
- Set `NEXT_PUBLIC_PB_URL=https://pb.example.com` **before building** (it is baked
  into the browser bundle). Changing it later requires a rebuild:
  `docker compose up -d --build panel`.
- The phone connects to the **panel** URL (from the QR), not PocketBase.
- PocketBase allows all CORS origins by default, so the panel domain can talk to
  the PocketBase domain from the browser.

## Option B — Railway

Create **two services** from this repo:

1. **PocketBase service**
   - Root directory: `pocketbase`
   - It builds from `pocketbase/Dockerfile`.
   - Add a **volume** mounted at `/pb/pb_data`.
   - Variables: `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD`.
   - Note its public URL (e.g. `https://pocketbase-production.up.railway.app`).

2. **Panel service**
   - Root directory: `smsgateway-panel`
   - It builds from `smsgateway-panel/Dockerfile`.
   - Build arg **and** variable `NEXT_PUBLIC_PB_URL` = the PocketBase public URL.
   - Variables: `POCKETBASE_INTERNAL_URL` = PocketBase private URL (or reuse the
     public one), `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD`.

Railway injects `PORT`; the panel image already honors it.

## Environment reference

| Variable                     | Service | Purpose                                                        |
| ---------------------------- | ------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_PB_URL`         | panel   | Public PocketBase URL, baked into the browser bundle at build. |
| `POCKETBASE_INTERNAL_URL`    | panel   | PocketBase URL the panel server uses (defaults to the public). |
| `POCKETBASE_ADMIN_EMAIL`     | both    | Superuser email.                                               |
| `POCKETBASE_ADMIN_PASSWORD`  | both    | Superuser password.                                            |

## After deploying

1. Open the panel, register an account, create an API key.
2. Generate the QR (its Panel URL should be your public panel URL).
3. Scan it in the Android app, grant SMS + phone permissions — done.
