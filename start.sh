#!/bin/sh
set -e

# Port the panel listens on (Railway/Render inject $PORT).
: "${PORT:=3000}"
export PORT
export HOSTNAME=0.0.0.0

DATA_DIR=/pb/pb_data
MIGRATIONS_DIR=/pb/pb_migrations

# Create/update the superuser from env — fully automatic, no manual command.
if [ -n "$POCKETBASE_ADMIN_EMAIL" ] && [ -n "$POCKETBASE_ADMIN_PASSWORD" ]; then
  echo "Upserting superuser $POCKETBASE_ADMIN_EMAIL ..."
  /pb/pocketbase superuser upsert "$POCKETBASE_ADMIN_EMAIL" "$POCKETBASE_ADMIN_PASSWORD" \
    --dir "$DATA_DIR" --migrationsDir "$MIGRATIONS_DIR" || echo "superuser upsert failed (continuing)"
else
  echo "WARNING: POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD not set — no superuser created."
fi

# Start PocketBase (migrations auto-apply, creating tables on first boot).
# Bound to 0.0.0.0 so its admin UI (/_/) is reachable when port 8090 is exposed;
# the panel still reaches it locally at 127.0.0.1:8090.
/pb/pocketbase serve --http=0.0.0.0:8090 \
  --dir "$DATA_DIR" --migrationsDir "$MIGRATIONS_DIR" &

echo "Waiting for PocketBase to be ready..."
until wget -qO- http://127.0.0.1:8090/api/health >/dev/null 2>&1; do
  sleep 0.5
done
echo "PocketBase ready. Starting panel on port $PORT ..."

# Run the Next.js panel in the foreground (container's main process).
exec node /app/server.js
