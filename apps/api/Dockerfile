# syntax=docker/dockerfile:1

# API image (§13.1). Built from the repository root so npm workspaces resolve:
#   docker build -f apps/api/Dockerfile -t finsight-api .
FROM node:24-alpine AS build
WORKDIR /repo
ENV CI=1

# Manifests first so dependency installation is cached independently of source.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/cache/package.json packages/cache/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN npm ci

COPY turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm run db:generate && npx turbo run build --filter=api

# The runtime image keeps dev dependencies on purpose: the one-off `migrate`
# service runs `prisma migrate deploy`, whose config loads `dotenv` and `prisma`
# from the workspace. Trimming them would make migrations fragile.

FROM node:24-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN addgroup -S finsight && adduser -S finsight -G finsight

COPY --from=build --chown=finsight:finsight /repo /repo

USER finsight
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# `docker compose run api node apps/api/dist/worker.js` runs the BullMQ worker
# from the same image.
CMD ["node", "apps/api/dist/index.js"]