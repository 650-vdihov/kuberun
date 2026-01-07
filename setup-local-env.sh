#!/bin/bash

# Setup script for local gRPC testing
# This creates .env files for each service

echo "🔧 Setting up local development environment"
echo "==========================================="
echo ""

# Create .env for activity service
cat > services/activity/.env.local << 'EOF'
PORT=4002
GRPC_PORT=50002
DATABASE_URL=postgresql://user:password@localhost:5436/activity_db
AUTH_SERVICE_URL=http://localhost:4001
TRUSTED_ORIGINS=http://localhost:4000
RABBITMQ_URL=amqp://user:password@localhost:5672
READINESS_TIMEOUT_MS=3000
RABBITMQ_RUN_COMPLETED_QUEUE=run.completed
RABBITMQ_RECONNECT_INTERVAL_MS=10000
EOF

ln -sf .env.local services/activity/.env
echo "✓ Created services/activity/.env"

# Create .env for clubs service
cat > services/clubs/.env.local << 'EOF'
PORT=4003
GRPC_PORT=50003
DATABASE_URL=postgresql://user:password@localhost:5437/clubs_db
AUTH_SERVICE_URL=http://localhost:4001
TRUSTED_ORIGINS=http://localhost:4000
READINESS_TIMEOUT_MS=3000
EOF

ln -sf .env.local services/clubs/.env
echo "✓ Created services/clubs/.env"

# Create .env for leaderboards service
cat > services/leaderboards/.env.local << 'EOF'
PORT=4004
ACTIVITY_GRPC_URL=localhost:50002
CLUBS_GRPC_URL=localhost:50003
AUTH_SERVICE_URL=http://localhost:4001
TRUSTED_ORIGINS=http://localhost:4000
RABBITMQ_URL=amqp://user:password@localhost:5672
READINESS_TIMEOUT_MS=3000
RABBITMQ_RUN_COMPLETED_QUEUE=run.completed
RABBITMQ_RECONNECT_INTERVAL_MS=10000
EOF

ln -sf .env.local services/leaderboards/.env
echo "✓ Created services/leaderboards/.env"

echo ""
echo "✅ Environment setup complete!"
echo ""
echo "⚠️  Make sure Docker services are running:"
echo "   docker-compose up -d activity-db clubs-db rabbitmq"
echo ""
echo "📝 Or start all infrastructure:"
echo "   docker-compose up -d"
echo ""
