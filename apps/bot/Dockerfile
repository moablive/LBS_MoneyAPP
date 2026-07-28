# syntax=docker/dockerfile:1.7
# MoneyAPP bot — single-package (sem monorepo). Runtime roda `tsx` direto no TS
# (paridade dev/prod). Os antigos workspace deps (@moneyapp/api-client e
# @moneyapp/models) foram vendorizados em src/vendor e resolvidos via tsconfig
# `paths` — por isso o tsconfig.json é copiado também no estágio runtime.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run typecheck

# ttf-dejavu + fontconfig: o sharp/libvips usa fontes do sistema para renderizar
# o texto dos gráficos de pizza (SVG -> PNG em src/utils/chart.ts).
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate \
 && apk add --no-cache ttf-dejavu fontconfig
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
COPY tsconfig.json ./
COPY src ./src
CMD ["pnpm", "start"]
