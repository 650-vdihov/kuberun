# syntax=docker/dockerfile:1

FROM node:20-slim AS base
WORKDIR /repo

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/metrics/package.json packages/metrics/tsconfig.json ./packages/metrics/
COPY services/leaderboards/package.json services/leaderboards/tsconfig.json ./services/leaderboards/

RUN pnpm install --frozen-lockfile --filter leaderboards...

COPY packages/metrics ./packages/metrics
COPY services/leaderboards ./services/leaderboards

RUN pnpm --filter leaderboards... build
RUN pnpm --filter leaderboards deploy -P /deploy

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /deploy/ ./

USER node

EXPOSE 4004
CMD ["node", "dist/index.js"]
