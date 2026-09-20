#!/bin/sh
set -e

# Create/update the superuser from env so the panel's API routes can auth.
# This is idempotent — safe to run on every container start.
if [ -n "$POCKETBASE_ADMIN_EMAIL" ] && [ -n "$POCKETBASE_ADMIN_PASSWORD" ]; then
  echo "Upserting superuser $POCKETBASE_ADMIN_EMAIL ..."
  ./pocketbase superuser upsert "$POCKETBASE_ADMIN_EMAIL" "$POCKETBASE_ADMIN_PASSWORD" || \
    echo "superuser upsert failed (continuing)"
fi

# Pending migrations in pb_migrations/ are applied automatically on serve.
exec ./pocketbase serve --http=0.0.0.0:8090
