#!/bin/bash
#
# OpenObserve Observability Stack - Setup Script
# This script helps you get started with the observability stack
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "OpenObserve Observability Stack Setup"
echo "========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
else
    echo -e "${GREEN}✓ Docker is installed${NC}"
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose v2+"
    exit 1
else
    echo -e "${GREEN}✓ Docker Compose is installed${NC}"
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Docker daemon is not running${NC}"
    echo "Please start Docker daemon"
    exit 1
else
    echo -e "${GREEN}✓ Docker daemon is running${NC}"
fi

echo ""
echo "All prerequisites satisfied!"
echo ""

# Generate Base64 auth for OpenTelemetry Collector
echo "Generating authentication token..."
AUTH_STRING="admin@example.com:Admin@123"
OPENOBSERVE_AUTH=$(echo -n "$AUTH_STRING" | base64)
echo "OPENOBSERVE_AUTH=$OPENOBSERVE_AUTH" > .env
echo -e "${GREEN}✓ Authentication token generated${NC}"
echo ""

# Ask if user wants to start the stack
read -p "Start the observability stack now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Starting services..."
    echo "This may take a few minutes on first run (downloading images + building apps)..."
    echo "  - Downloading Docker images: ~1-2 minutes"
    echo "  - Building Node.js app: ~15 seconds"
    echo "  - Building Python app: ~10 seconds"
    echo ""
    
    docker compose up -d
    
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}Stack is starting!${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo "Waiting for services to be healthy..."
    sleep 10
    
    # Check service status
    echo ""
    echo "Service Status:"
    docker compose ps
    
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}Setup Complete!${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo "Access the services:"
    echo ""
    echo -e "  ${GREEN}OpenObserve UI:${NC}      http://localhost:5080"
    echo -e "  ${GREEN}Email:${NC}               admin@example.com"
    echo -e "  ${GREEN}Password:${NC}            Admin@123"
    echo ""
    echo -e "  ${GREEN}Node.js App:${NC}         http://localhost:3000"
    echo -e "  ${GREEN}Python App:${NC}          http://localhost:8000"
    echo -e "  ${GREEN}OTel Collector:${NC}      http://localhost:13133"
    echo ""
    echo "Useful commands:"
    echo ""
    echo "  View logs:              docker compose logs -f"
    echo "  View specific service:  docker compose logs -f openobserve"
    echo "  Stop services:          docker compose down"
    echo "  Restart services:       docker compose restart"
    echo ""
    echo "Traffic is being generated automatically."
    echo "Open OpenObserve UI to see logs, metrics, and traces!"
    echo ""
else
    echo ""
    echo "Setup complete. To start the stack later, run:"
    echo "  docker compose up -d"
    echo ""
fi
