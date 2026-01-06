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
- Queries activity database for run data
- Queries clubs database for membership data
- Listens to RabbitMQ for real-time run completion events
- Computes leaderboards on-demand (can be cached in future)

## Environment Variables

```bash
PORT=4004
ACTIVITY_DB_URL=postgresql://user:password@localhost:5436/activity_db
CLUBS_DB_URL=postgresql://user:password@localhost:5437/clubs_db
AUTH_SERVICE_URL=http://localhost:4001
TRUSTED_ORIGINS=http://localhost:4000
RABBITMQ_URL=amqp://user:password@localhost:5672
RABBITMQ_RUN_COMPLETED_QUEUE=run.completed
RABBITMQ_HEARTBEAT_SECONDS=30
RABBITMQ_CONNECTION_TIMEOUT_MS=10000
RABBITMQ_RECONNECT_INTERVAL_MS=5000
```

## Development

```bash
# From project root:

# 1. Start infrastructure (databases, RabbitMQ, nginx)
docker-compose up -d

# 2. Services run in Docker by default
# View logs for this service:
docker logs leaderboards-service -f

# 3. Rebuild after code changes
docker-compose up -d --build leaderboards-service
```

**Note:** All services are containerized and managed via `docker-compose`. The `pnpm run dev` command is available for local development but requires manual setup of all dependencies.

## Notes

- Does not have its own database (reads from activity and clubs databases)
- Future optimization: Cache leaderboards in Redis or dedicated tables
