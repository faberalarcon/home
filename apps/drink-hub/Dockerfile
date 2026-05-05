# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /repo/apps/drink-hub
ARG BASE_PATH=/drinks
ARG CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ENV BASE_PATH=$BASE_PATH
ENV CSRF_TRUSTED_ORIGINS=$CSRF_TRUSTED_ORIGINS

# better-sqlite3 needs build tools to compile its native binding
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# sharp uses prebuilt libvips binaries; ensure they're fetched for the build arch
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

COPY apps/drink-hub/package.json apps/drink-hub/package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY packages /repo/packages
COPY apps/drink-hub /repo/apps/drink-hub
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    BASE_PATH=/drinks \
    DATABASE_PATH=/app/data/drink-hub.db

COPY --from=build /repo/apps/drink-hub/build ./build
COPY --from=build /repo/apps/drink-hub/node_modules ./node_modules
COPY --from=build /repo/apps/drink-hub/package.json ./package.json
COPY --from=build /repo/apps/drink-hub/drizzle ./drizzle

# Create data directory and set ownership before dropping to non-root
RUN mkdir -p /app/data/uploads/items /app/data/uploads/profiles && chown -R node:node /app/data

COPY apps/drink-hub/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER node

EXPOSE 3000
# Entrypoint runs as node user, ensures upload subdirs exist, then execs the app
ENTRYPOINT ["/entrypoint.sh"]
