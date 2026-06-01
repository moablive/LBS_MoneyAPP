# syntax=docker/dockerfile:1.7
# Build context is the monorepo root so workspace deps resolve correctly.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/
COPY packages/models/package.json packages/models/
COPY packages/db/package.json packages/db/
COPY packages/api-client/package.json packages/api-client/
COPY packages/services/package.json packages/services/
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY packages/ packages/
COPY apps/backend apps/backend
# Ensure the migrations folder exists even on the first build (it is normally
# populated by `pnpm db:generate` on the host before docker build).
RUN mkdir -p apps/backend/drizzle \
 && pnpm --filter @moneyapp/models run typecheck \
 && pnpm --filter @moneyapp/db run typecheck \
 && pnpm --filter @moneyapp/api-client run typecheck \
 && pnpm --filter @moneyapp/services run typecheck \
 && pnpm --filter @moneyapp/backend run typecheck

# Runtime image runs `tsx` directly against TypeScript sources — avoids the
# NodeNext-ESM `.js` extension dance and keeps the image close to dev parity.
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/tsconfig.base.json ./
COPY --from=build /repo/packages/ packages/
COPY --from=build /repo/apps/backend apps/backend
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
EXPOSE 3000
WORKDIR /app/apps/backend
CMD ["pnpm", "start"]
