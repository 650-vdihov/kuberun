# Kuberun — Technical Documentation

Kuberun is a React Native (Expo) mobile app backed by a set of Node.js (TypeScript) microservices. This repo is a pnpm + Turborepo monorepo.

## Repository Layout

- `apps/mobile/` — Expo mobile app (Expo Router)
- `services/` — Microservices (Hono + Drizzle + Postgres, plus gRPC/RabbitMQ where needed)
- `packages/` — Shared packages (notably `packages/metrics/` for Prometheus metrics)
- `infra/helm/` — Helm charts for Kubernetes/AKS deployment
- `docker-compose.yml` — Local stack (services, databases, RabbitMQ, monitoring)
- `nginx.conf` — Local NGINX API gateway routing

## Architecture Overview

At a high level:

- Mobile app talks to a single **API Gateway** (NGINX).
- Gateway routes to microservices over HTTP.
- Each microservice owns its **own Postgres database** (no shared DB).
- **Auth** issues long-lived session tokens and short-lived JWTs; other services validate JWTs via the auth service’s JWKS.
- **Activity** publishes `run.completed` events to RabbitMQ.
- **Leaderboards** consumes `run.completed` events and stores run snapshots to compute leaderboards.
- **gRPC** is used for internal service-to-service calls:
  - Clubs → Activity (fetch user profiles)
  - Leaderboards → Clubs (fetch club members)
  - Leaderboards → Activity (fetch user profiles; optional run stats API exists)
- **Weather enrichment** is done via an Azure Function called by the Activity service.

## Local URLs & Ports (Docker Compose)

- API Gateway: `http://localhost:4000`
- Weather Function (local container): `http://localhost:7071/api/enrichWeather`
- RabbitMQ: `amqp://localhost:5672`, UI: `http://localhost:15672`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000` (default `admin/admin`)
- Postgres (host ports):
  - Auth DB: `localhost:5435`
  - Activity DB: `localhost:5436`
  - Clubs DB: `localhost:5437`
  - Leaderboards DB: `localhost:5438`

## API Gateway Routing

The gateway prefixes requests by service:

- Auth: `http://localhost:4000/auth/...`
- Activity: `http://localhost:4000/activity/...`
- Clubs: `http://localhost:4000/clubs/...`
- Leaderboards: `http://localhost:4000/leaderboards/...`

## Authentication Model (Mobile ↔ Services)

The mobile app uses a 2-step token approach:

1. **Session token** (long-lived) is obtained from Better Auth:
   - `POST /auth/api/auth/sign-up/email`
   - `POST /auth/api/auth/sign-in/email`
2. **JWT** (short-lived) is minted from the session token and used for microservice calls:
   - `GET /auth/api/auth/token` with `Authorization: Bearer <session_token>`
   - The mobile app then calls other services with `Authorization: Bearer <jwt>`

Microservices validate JWTs locally using the auth service JWKS that are cached in the app:

- JWKS: `GET /auth/.well-known/jwks.json` (via gateway) or `GET /api/auth/jwks` (direct to auth service)

## Microservices

All HTTP services expose (under the gateway prefix for that service):

- `GET /<service>/health` — liveness
- `GET /<service>/ready` — readiness (dependency checks)
- `GET /<service>/metrics` — Prometheus metrics

### Auth Service (`services/auth/`)

Responsibilities:

- User accounts + sessions (Better Auth + Drizzle)
- JWT minting + JWKS publishing for other services
- Password reset email via Resend

Base path (gateway): `/auth`

Key endpoints (gateway form):

- `GET /auth/health`, `GET /auth/ready`, `GET /auth/metrics`
- `POST|GET /auth/api/auth/**` (Better Auth endpoints)
- `GET /auth/.well-known/jwks.json`

Config: `services/auth/.env.example`

### Activity Service (`services/activity/`)

Responsibilities:

- User profile (name, weight, image, …)
- Run lifecycle and GPS tracking points
- Weekly dashboard aggregates
- Publishes `run.completed` to RabbitMQ
- Calls the Weather Function to enrich completed runs
- gRPC server for internal data reads

Base path (gateway): `/activity`

Key endpoints (gateway form):

- Profile: `GET /activity/profile`, `POST /activity/profile`
- Runs:
  - `GET /activity/runs` (filters + pagination)
  - `POST /activity/runs/start`
  - `POST /activity/runs/:id/track`
  - `POST /activity/runs/:id/pause`, `POST /activity/runs/:id/resume`
  - `POST /activity/runs/:id/complete`
  - `GET /activity/runs/:id` (`?includePoints=true` to include tracking points)
  - `GET /activity/runs/active/current`
  - `DELETE /activity/runs/:id`
- Dashboard:
  - `GET /activity/dashboard/weekly-stats`
  - `GET /activity/dashboard/daily-distances`
  - `GET /activity/dashboard/featured`

gRPC (internal, default `GRPC_PORT=50002`):

- `ActivityService.GetUserProfiles(user_ids[])`
- `ActivityService.GetRunStats(user_ids[], start_date, end_date?)`

Config: `services/activity/.env.example`

### Clubs Service (`services/clubs/`)

Responsibilities:

- Clubs, memberships, invitations
- gRPC server for membership reads
- gRPC client to Activity for profile enrichment in member lists

Base path (gateway): `/clubs`

Key endpoints (gateway form):

- `GET /clubs/health`, `GET /clubs/ready`, `GET /clubs/metrics`
- Authenticated:
  - `GET /clubs/clubs`, `POST /clubs/clubs`
  - `GET /clubs/clubs/:id`, `GET /clubs/clubs/:id/members`
  - `POST /clubs/clubs/:id/invite`
  - `DELETE /clubs/clubs/:id/leave`
  - `GET /clubs/invites`, `POST /clubs/invites/:id/accept`, `POST /clubs/invites/:id/decline`
  - `DELETE /clubs/clubs/:clubId/members/:userId`
  - `POST /clubs/clubs/:clubId/members/:userId/promote`, `POST /clubs/clubs/:clubId/members/:userId/demote`
  - `PUT /clubs/clubs/:id/preferences`


### Leaderboards Service (`services/leaderboards/`)

Responsibilities:

- Consumes `run.completed` events from RabbitMQ and stores runs locally
- Computes weekly / last-week / monthly club leaderboards
- Uses gRPC to resolve club membership and profile data

Base path (gateway): `/leaderboards`

Key endpoints (gateway form):

- `GET /leaderboards/club/:clubId/weekly`
- `GET /leaderboards/club/:clubId/last-week`
- `GET /leaderboards/club/:clubId/monthly`

More details: `services/leaderboards/README.md`

### Weather Function (`services/weather-function/`)

Responsibilities:

- HTTP endpoint that enriches a run with weather data from WeatherAPI.com

HTTP:

- `POST /api/enrichWeather` (local: `http://localhost:7071/api/enrichWeather`)

More details: `services/weather-function/README.md`

## Data & Migrations (Drizzle)

Each service owns its DB schema:

- Auth: `user`, `session`, `account`, `verification`, `jwks`
- Activity: `user_profiles`, `runs`, `run_tracking_points`
- Clubs: `clubs`, `club_members`, `club_invites`
- Leaderboards: `runs` (denormalized event-sourced snapshot)

Local DB init (example):

```bash
docker-compose up -d

cd services/auth && cp .env.example .env && pnpm db:migrate
cd ../activity && cp .env.example .env && pnpm db:migrate
cd ../clubs && cp .env.example .env && pnpm db:migrate
cd ../leaderboards && cp .env.example .env && pnpm db:migrate
```

## Mobile App (`apps/mobile/`)

Tech stack:

- Expo + React Native + Expo Router
- AsyncStorage for storing auth session and cached JWT

Key flows:

- Authentication via `AuthProvider` (`apps/mobile/contexts/auth-context.tsx`)
- Automatic JWT refresh on API calls via `apiClient` (`apps/mobile/lib/api-client.ts`)
- Run tracking uses `expo-location` and posts points to Activity Service

Run the mobile app:

```bash
cd apps/mobile
cp .env.example .env
pnpm dev
```

If using a physical device, `EXPO_PUBLIC_API_BASE_URL` must be reachable from the device (use your LAN IP or a deployed gateway URL).

## Deployment

### Kubernetes / AKS (Helm)

- Helm charts live in `infra/helm/` (auth, activity, clubs, leaderboards, api-gateway, rabbitmq).

### Azure Function (Weather Enrichment)

- The Weather Function is deployed separately from AKS.
