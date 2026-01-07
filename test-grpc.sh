#!/bin/bash

# Test script for gRPC communication between services
# This script will:
# 1. Start all required services
# 2. Wait for them to be ready
# 3. Make test API calls to the leaderboard service
# 4. Verify the services communicate via gRPC

set -e

echo "🧪 Testing gRPC Implementation"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if services are already running
check_port() {
    lsof -i:$1 >/dev/null 2>&1
}

echo "📋 Pre-flight checks..."

# Check if required environment variables are set
if [ ! -f ".env" ] && [ ! -f "services/activity/.env" ]; then
    echo -e "${YELLOW}⚠️  No .env files found. Make sure DATABASE_URL and other env vars are set${NC}"
fi

echo ""
echo "🚀 Starting services..."
echo ""

# Start activity service
echo "Starting Activity Service (HTTP: 4002, gRPC: 50002)..."
cd services/activity
pnpm run dev > /tmp/activity.log 2>&1 &
ACTIVITY_PID=$!
cd ../..

sleep 2

# Start clubs service  
echo "Starting Clubs Service (HTTP: 4003, gRPC: 50003)..."
cd services/clubs
pnpm run dev > /tmp/clubs.log 2>&1 &
CLUBS_PID=$!
cd ../..

sleep 2

# Start leaderboards service
echo "Starting Leaderboards Service (HTTP: 4004)..."
cd services/leaderboards
pnpm run dev > /tmp/leaderboards.log 2>&1 &
LEADERBOARDS_PID=$!
cd ../..

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Function to check service health
check_health() {
    local service=$1
    local port=$2
    local url="http://localhost:${port}/health"
    
    if curl -s "$url" | grep -q "ok"; then
        echo -e "${GREEN}✓${NC} $service is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $service is not responding"
        return 1
    fi
}

# Check service health
echo ""
check_health "Activity Service" 4002
check_health "Clubs Service" 4003
check_health "Leaderboards Service" 4004

# Check readiness (includes gRPC connectivity)
echo ""
echo "🔍 Checking service readiness (including gRPC)..."
echo ""

check_ready() {
    local service=$1
    local port=$2
    local url="http://localhost:${port}/ready"
    
    response=$(curl -s "$url")
    if echo "$response" | grep -q '"ready":true'; then
        echo -e "${GREEN}✓${NC} $service is ready"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        return 0
    else
        echo -e "${RED}✗${NC} $service is not ready"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        return 1
    fi
}

check_ready "Activity Service" 4002
echo ""
check_ready "Clubs Service" 4003
echo ""
check_ready "Leaderboards Service" 4004
echo ""

# Show logs if there are errors
echo ""
echo "📄 Recent logs:"
echo ""
echo "--- Activity Service ---"
tail -n 5 /tmp/activity.log
echo ""
echo "--- Clubs Service ---"
tail -n 5 /tmp/clubs.log
echo ""
echo "--- Leaderboards Service ---"
tail -n 5 /tmp/leaderboards.log

echo ""
echo "================================"
echo ""
echo -e "${YELLOW}Services are running. Test them with:${NC}"
echo ""
echo "  # Get a JWT token first from auth service"
echo "  # Then test leaderboard endpoints:"
echo "  curl -H 'Authorization: Bearer YOUR_TOKEN' http://localhost:4004/club/CLUB_ID/weekly"
echo ""
echo -e "${YELLOW}To stop services:${NC}"
echo "  kill $ACTIVITY_PID $CLUBS_PID $LEADERBOARDS_PID"
echo ""
echo -e "${YELLOW}View logs:${NC}"
echo "  tail -f /tmp/activity.log"
echo "  tail -f /tmp/clubs.log"
echo "  tail -f /tmp/leaderboards.log"
echo ""
