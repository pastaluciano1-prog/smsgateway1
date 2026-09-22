FROM alpine:3.20

ARG PB_VERSION=0.40.4
ARG TARGETARCH=amd64

RUN apk add --no-cache ca-certificates unzip wget

WORKDIR /pb

# Download the matching PocketBase release binary.
RUN wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pb.zip \
  && unzip /tmp/pb.zip -d /pb \
  && rm /tmp/pb.zip

# Migrations auto-apply on `serve`, creating the collections on first boot.
COPY pb_migrations ./pb_migrations
COPY docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8090
# NOTE: no VOLUME directive on purpose — Railway/Render attach their own
# persistent volume at /pb/pb_data via the dashboard, and a Dockerfile VOLUME
# can create an anonymous volume that shadows it. Mount /pb/pb_data yourself
# (compose does this in docker-compose.yml).

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
