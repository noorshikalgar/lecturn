# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app

# ---- deps: install full workspace (dev deps included, needed to compile) ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

# ---- build: compile backend TypeScript ----
FROM deps AS build
COPY packages/shared packages/shared
COPY backend backend
RUN npm run build -w backend

# ---- prod-deps: backend's own runtime dependencies only ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --workspace=backend

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production

# ffmpeg/ffprobe are needed for duration/resolution probing, cover-frame
# extraction, lazy MKV remuxing, and SRT->VTT conversion.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 coursedeck && useradd --system --uid 1001 --gid coursedeck coursedeck

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/backend/dist ./dist
COPY backend/src/db/migrations ./src/db/migrations
COPY backend/package.json ./package.json

RUN mkdir -p /app/backend/data && chown -R coursedeck:coursedeck /app/backend

USER coursedeck
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
