# syntax=docker/dockerfile:1.7
# Build context is the monorepo root so workspace deps (@moneyapp/db) resolve.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/bot/package.json apps/bot/
COPY packages/models/package.json packages/models/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY packages/ packages/
COPY apps/bot apps/bot
# Typecheck the bot — pulls in @moneyapp/db's types transitively.
RUN pnpm --filter @moneyapp/bot run typecheck

# Runtime runs `tsx` directly against TS sources (dev parity, no .js-extension
# dance). `tsx` is a prod dependency so --prod keeps it. ttf-dejavu + fontconfig
# are needed so the SVG pie charts render text (sharp/libvips uses system fonts).
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate \
 && apk add --no-cache ttf-dejavu fontconfig
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/tsconfig.base.json ./
COPY --from=build /repo/packages/ packages/
COPY --from=build /repo/apps/bot apps/bot
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
WORKDIR /app/apps/bot
CMD ["pnpm", "start"]
