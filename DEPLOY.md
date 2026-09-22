# Deploying the SMS Gateway

There are two shapes. Most people want the first.

---

## Option 1 — One container (recommended, "host and boom")

The root `Dockerfile` bundles **PocketBase + the panel in a single image**. The
panel proxies PocketBase at `/pb`, so there's only **one service and one public
URL**. The superuser and database tables are created automatically on first boot.

### Railway

1. **New Project → Deploy from GitHub repo**, pick this repo.
2. In the service's **Settings**:
   - **Root Directory:** `/` (the repo root — it uses the root `Dockerfile`).
   - **Add a Volume**, mount path **`/pb/pb_data`** (this is your database; it's
     the only thing that must persist).
3. In **Variables**, add just two:
   - `POCKETBASE_ADMIN_EMAIL` = your admin email
   - `POCKETBASE_ADMIN_PASSWORD` = a strong password
4. Deploy. That's it.

On first boot the container creates the superuser, applies the migrations
(creating all tables), and starts the panel. Open the service URL, register,
create an API key, and connect your phone.

> You do **not** need to set `NEXT_PUBLIC_PB_URL` — it defaults to `/pb` (the
> panel proxies PocketBase for the browser). Railway injects `PORT` automatically.

**PocketBase admin UI** is reachable at `https://<your-app>/pb/_/` with the same
admin email/password.

### Render / Fly / any single Docker host

Same idea — one service from the root `Dockerfile`:

```bash
docker build -t sms-gateway .
docker run -d -p 3000:3000 \
  -e POCKETBASE_ADMIN_EMAIL=admin@example.com \
  -e POCKETBASE_ADMIN_PASSWORD='a-strong-password' \
  -v sms_pb_data:/pb/pb_data \
  sms-gateway
```

Panel + admin UI on port 3000 (`/` and `/pb/_/`).

---

## Option 2 — Two services (split PocketBase + panel)

Use this if you want PocketBase and the panel scaled/hosted separately. It's the
`docker-compose.yml` at the repo root:

```bash
cp .env.example .env      # set POCKETBASE_ADMIN_PASSWORD, and NEXT_PUBLIC_PB_URL
docker compose up -d --build
```

- Panel → `:3000`, PocketBase → `:8090` (admin at `/_/`).
- Here the browser talks to PocketBase **directly**, so `NEXT_PUBLIC_PB_URL`
  must be PocketBase's public URL (set it before building; it's baked into the
  browser bundle).
- On Railway this means two services and a volume on the PocketBase one — which
  is exactly the manual fiddling Option 1 avoids.

---

## Environment reference

| Variable | Needed | Purpose |
| -------- | ------ | ------- |
| `POCKETBASE_ADMIN_EMAIL` | always | Superuser, created automatically on boot. |
| `POCKETBASE_ADMIN_PASSWORD` | always | Superuser password. |
| `NEXT_PUBLIC_PB_URL` | Option 2 only | Public PocketBase URL for the browser (Option 1 defaults it to `/pb`). |
| `POCKETBASE_INTERNAL_URL` | auto | Where the panel server reaches PocketBase (Option 1 sets `http://127.0.0.1:8090`). |
| `PORT` | auto | Injected by the host; the panel listens on it. |

## After deploying

1. Open the panel URL, register, create an API key, **Generate QR**.
2. Scan it in the app (the QR's Panel URL should be your deployed URL).
3. Grant SMS + phone permissions, allow background running. Done.

The **data** lives in the volume at `/pb/pb_data` — back that up. The schema
itself is code (`pocketbase/pb_migrations/`) and rebuilds automatically, so a
fresh deploy always self-provisions its tables.
