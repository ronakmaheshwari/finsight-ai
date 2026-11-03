# syntax=docker/dockerfile:1

# Web image (§13.1): Vite build served by nginx, which proxies /api to the API.
#   docker build -f apps/frontend/Dockerfile -t finsight-web .
FROM node:24-alpine AS build
WORKDIR /repo
ENV CI=1

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
COPY apps/frontend ./apps/frontend

# Same-origin by default: nginx proxies /api to the API service.
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npx turbo run build --filter=frontend

FROM nginx:1.27-alpine AS runtime
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
