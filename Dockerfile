# ---- build stage ----
FROM node:22-bookworm-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732 AS build
WORKDIR /repo

# better-sqlite3 needs build tools for native bindings.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

COPY package.json package-lock.json ./
COPY packages ./packages
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-bookworm-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732 AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/app/data/drink-hub.db \
    UPLOADS_DIR=/var/www/21bristoe-media \
    BODY_SIZE_LIMIT=104857600

COPY --from=build /repo/build ./build
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/drizzle ./drizzle

RUN mkdir -p /app/data /var/www/21bristoe-media && chown -R node:node /app/data /var/www/21bristoe-media

USER node
EXPOSE 3000

# Liveness probe: the server answers the homepage once it's up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "build/index.js"]
