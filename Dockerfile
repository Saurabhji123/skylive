# syntax=docker/dockerfile:1

FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Install workspace dependencies (root + packages) in one pass
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspaces --include-workspace-root

# Copy sources and build only the pieces the backend needs
COPY . .
RUN npm run build --workspace=@skylive/shared \
 && npm run build --workspace=backend

# Drop development-only dependencies after the build
# Keeping prune disabled for now to preserve workspace runtime deps
# RUN npm prune --omit=dev --workspaces --include-workspace-root

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 4000
CMD ["node", "backend/dist/server.js"]
