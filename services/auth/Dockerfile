# syntax=docker/dockerfile:1

FROM node:20-slim AS base
WORKDIR /repo

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/metrics/package.json packages/metrics/tsconfig.json ./packages/metrics/
COPY services/auth/package.json services/auth/tsconfig.json ./services/auth/

RUN pnpm install --frozen-lockfile --filter auth...

COPY packages/metrics ./packages/metrics
COPY services/auth ./services/auth

RUN pnpm --filter auth... build
RUN pnpm --filter auth deploy -P /deploy

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /deploy/ ./

USER node

EXPOSE 4001
CMD ["node", "dist/index.js"]
