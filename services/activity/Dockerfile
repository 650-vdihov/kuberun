# syntax=docker/dockerfile:1

FROM node:20-slim AS base
WORKDIR /repo

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/metrics/package.json packages/metrics/tsconfig.json ./packages/metrics/
COPY services/activity/package.json services/activity/tsconfig.json ./services/activity/

RUN pnpm install --frozen-lockfile --filter activity...

COPY packages/metrics ./packages/metrics
COPY services/activity ./services/activity

RUN pnpm --filter activity... build
RUN pnpm --filter activity deploy -P /deploy

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /deploy/ ./

USER node

EXPOSE 4002
CMD ["node", "dist/index.js"]
