# syntax=docker/dockerfile:1

FROM node:20-slim AS base
WORKDIR /repo

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/metrics/package.json packages/metrics/tsconfig.json ./packages/metrics/
COPY services/clubs/package.json services/clubs/tsconfig.json ./services/clubs/

RUN pnpm install --frozen-lockfile --filter clubs...

COPY packages/metrics ./packages/metrics
COPY services/clubs ./services/clubs

RUN pnpm --filter clubs... build
RUN pnpm --filter clubs deploy -P /deploy

# Copy proto files to dist (TypeScript doesn't copy .proto files)
RUN mkdir -p /deploy/dist/proto
RUN cp /repo/services/clubs/src/proto/*.proto /deploy/dist/proto/

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /deploy/ ./

USER node

EXPOSE 4003
CMD ["node", "dist/index.js"]
