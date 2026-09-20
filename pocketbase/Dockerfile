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
# SQLite data (and uploaded files) persist here.
VOLUME ["/pb/pb_data"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
