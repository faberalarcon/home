# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ENV CSRF_TRUSTED_ORIGINS=$CSRF_TRUSTED_ORIGINS

# better-sqlite3 needs build tools to compile its native binding
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# sharp uses prebuilt libvips binaries; ensure they're fetched for the build arch
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/app/data/drink-hub.db

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/drizzle ./drizzle

# Create data directory and set ownership before dropping to non-root
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data

USER node

EXPOSE 3000
CMD ["node", "build/index.js"]
