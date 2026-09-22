# One-container deploy: PocketBase + the Next.js panel together.
# The panel proxies PocketBase at /pb, so only ONE public port is needed —
# ideal for Railway / Render / Fly / a single Docker host. Attach a volume at
# /pb/pb_data and set POCKETBASE_ADMIN_EMAIL + POCKETBASE_ADMIN_PASSWORD.

# ---- build the panel ----
FROM node:22-alpine AS build
WORKDIR /app
COPY smsgateway-panel/package.json smsgateway-panel/package-lock.json ./
RUN npm ci
COPY smsgateway-panel/ ./
# Browser talks to PocketBase through the panel's /pb proxy (same origin).
ARG NEXT_PUBLIC_PB_URL=/pb
ENV NEXT_PUBLIC_PB_URL=$NEXT_PUBLIC_PB_URL
RUN npm run build

# ---- runtime: panel + pocketbase in one image ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
# The panel's server + /pb proxy reach the co-located PocketBase here.
ENV POCKETBASE_INTERNAL_URL=http://127.0.0.1:8090

ARG PB_VERSION=0.40.4
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates wget unzip \
  && rm -rf /var/lib/apt/lists/* \
  && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -O /tmp/pb.zip \
  && mkdir -p /pb \
  && unzip /tmp/pb.zip -d /pb \
  && rm /tmp/pb.zip

# Schema (auto-applied on first boot).
COPY pocketbase/pb_migrations /pb/pb_migrations

# Next.js standalone server + assets.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

COPY start.sh /start.sh
RUN chmod +x /start.sh

# Railway/hosts inject $PORT; the panel listens on it (default 3000).
EXPOSE 3000
CMD ["/start.sh"]
