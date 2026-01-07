#!/bin/bash

# Simple gRPC verification script
# This checks if gRPC servers are listening on their ports

echo "🔍 Checking gRPC Server Ports"
echo "=============================="
echo ""

check_grpc_port() {
    local service=$1
    local port=$2
    
    if lsof -i:$port >/dev/null 2>&1; then
        echo "✓ $service gRPC server is listening on port $port"
        lsof -i:$port | grep LISTEN
    else
        echo "✗ $service gRPC server is NOT listening on port $port"
    fi
    echo ""
}

check_grpc_port "Activity" 50002
check_grpc_port "Clubs" 50003

echo ""
echo "HTTP Service Ports:"
check_grpc_port "Activity HTTP" 4002
check_grpc_port "Clubs HTTP" 4003
check_grpc_port "Leaderboards HTTP" 4004
