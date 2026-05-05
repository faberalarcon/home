# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /repo/apps/stats
ARG BASE_PATH=/stats
ENV BASE_PATH=$BASE_PATH

COPY apps/stats/package.json apps/stats/package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY packages /repo/packages
COPY apps/stats /repo/apps/stats
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    BASE_PATH=/stats

COPY --from=build /repo/apps/stats/build ./build
COPY --from=build /repo/apps/stats/node_modules ./node_modules
COPY --from=build /repo/apps/stats/package.json ./package.json

USER node

EXPOSE 3000
CMD ["node", "build/index.js"]
