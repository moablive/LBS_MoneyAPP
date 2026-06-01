# syntax=docker/dockerfile:1.7
ARG VITE_API_BASE_URL=/api

FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/frontend/package.json apps/frontend/
COPY packages/models/package.json packages/models/
COPY packages/db/package.json packages/db/
COPY packages/api-client/package.json packages/api-client/
COPY packages/services/package.json packages/services/
RUN pnpm install --frozen-lockfile || pnpm install
COPY packages/ packages/
COPY apps/frontend apps/frontend
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm --filter @moneyapp/frontend run build

FROM nginx:1.27-alpine AS runtime
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
