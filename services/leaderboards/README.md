# Leaderboards Service

Microservice for computing and serving leaderboards for clubs.

## Features

- Weekly club leaderboards (current and last week)
- Monthly club leaderboards
- Distance and active time rankings
- Real-time updates via RabbitMQ

## Endpoints

### Public
- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /metrics` - Prometheus metrics

### Authenticated
- `GET /club/:clubId/weekly` - Current week leaderboard
- `GET /club/:clubId/last-week` - Last week leaderboard
- `GET /club/:clubId/monthly` - Current month leaderboard

**Note:** When accessed through nginx gateway at port 4000, use `/leaderboards/club/:clubId/weekly` etc.

## Architecture

This service:
- Receives run completion events via RabbitMQ
- Stores run data locally in PostgreSQL database
- Queries clubs service via gRPC for membership data
- Computes leaderboards on-demand from local data

## Database

The service maintains its own PostgreSQL database with a `runs` table that stores:
- Run ID, user ID
- Distance, duration, pace, avg speed, calories
- Start time, end time, completion timestamp

## Environment Variables

```bash
PORT=4004
DATABASE_URL=postgresql://user:password@localhost:5438/leaderboards_db
ACTIVITY_GRPC_URL=localhost:50002
CLUBS_GRPC_URL=localhost:50003
AUTH_SERVICE_URL=http://localhost:4001
TRUSTED_ORIGINS=http://localhost:4000
RABBITMQ_URL=amqp://user:password@localhost:5672
RABBITMQ_RUN_COMPLETED_QUEUE=run.completed
RABBITMQ_HEARTBEAT_SECONDS=30
RABBITMQ_CONNECTION_TIMEOUT_MS=10000
RABBITMQ_RECONNECT_INTERVAL_MS=5000
READINESS_TIMEOUT_MS=3000
```

## Development

```bash
# From project root:

# 1. Start infrastructure (databases, RabbitMQ, nginx)
docker-compose up -d

# 2. Generate and run database migrations (first time setup)
cd services/leaderboards
pnpm db:generate  # Already done - migration exists
pnpm db:migrate   # Run migrations against database

# 3. Services run in Docker by default
# View logs for this service:
docker logs leaderboards-service -f

# 4. Rebuild after code changes
docker-compose up -d --build leaderboards-service
```

## Database Schema

The `runs` table schema:
```sql
CREATE TABLE "runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "distance" numeric(10, 2) NOT NULL,
  "duration" integer NOT NULL,
  "pace" numeric(5, 2),
  "avg_speed" numeric(5, 2),
  "calories" integer,
  "start_time" timestamp NOT NULL,
  "end_time" timestamp NOT NULL,
  "completed_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
```
```

**Note:** All services are containerized and managed via `docker-compose`. The `pnpm run dev` command is available for local development but requires manual setup of all dependencies.

## Notes

- Does not have its own database (reads from activity and clubs databases)
- Future optimization: Cache leaderboards in Redis or dedicated tables
