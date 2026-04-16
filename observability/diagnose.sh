#!/bin/bash

# Diagnostic script for OpenObserve observability stack
# This script helps diagnose why logs, traces, or metrics aren't appearing

set -e

echo "========================================="
echo "OpenObserve Stack Diagnostic Tool"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker compose is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
    exit 1
fi

echo "Step 1: Checking service status..."
echo "-----------------------------------"
SERVICES=$(docker compose ps --format json 2>/dev/null || echo "[]")

if [ "$SERVICES" == "[]" ] || [ -z "$SERVICES" ]; then
    echo -e "${RED}❌ No services are running${NC}"
    echo ""
    echo "To start services, run:"
    echo "  docker compose up -d"
    exit 1
fi

# Parse and display service status
docker compose ps

# Check each critical service
echo ""
echo "Step 2: Checking critical services..."
echo "--------------------------------------"

check_service() {
    local service=$1
    local status=$(docker compose ps "$service" --format "{{.Status}}" 2>/dev/null | head -1)
    
    # Check if status contains "Up" (case-insensitive)
    if [[ "$status" =~ ^Up ]]; then
        echo -e "${GREEN}✓${NC} $service is running"
        return 0
    else
        echo -e "${RED}✗${NC} $service is NOT running (status: ${status:-not found})"
        return 1
    fi
}

ALL_OK=true
check_service "openobserve" || ALL_OK=false
check_service "otel-collector" || ALL_OK=false  
check_service "nodejs-app" || ALL_OK=false
check_service "python-app" || ALL_OK=false

if [ "$ALL_OK" = false ]; then
    echo ""
    echo -e "${YELLOW}⚠ Some services are not running. Try:${NC}"
    echo "  docker compose down"
    echo "  docker compose up -d"
    echo "  sleep 30  # Wait for initialization"
    exit 1
fi

echo ""
echo "Step 3: Checking for errors in logs..."
echo "---------------------------------------"

# Check OTel Collector for errors
echo "Checking OTel Collector logs..."
COLLECTOR_ERRORS=$(docker compose logs otel-collector --tail=100 2>&1 | grep -iE "error|failed|404|401|500" || true)

if [ -n "$COLLECTOR_ERRORS" ]; then
    echo -e "${YELLOW}⚠ Found errors in OTel Collector logs:${NC}"
    echo "$COLLECTOR_ERRORS" | tail -10
    echo ""
else
    echo -e "${GREEN}✓${NC} No obvious errors in OTel Collector logs"
fi

# Check OpenObserve for errors  
echo "Checking OpenObserve logs..."
OPENOBSERVE_ERRORS=$(docker compose logs openobserve --tail=100 2>&1 | grep -iE "error|failed" || true)

if [ -n "$OPENOBSERVE_ERRORS" ]; then
    echo -e "${YELLOW}⚠ Found errors in OpenObserve logs:${NC}"
    echo "$OPENOBSERVE_ERRORS" | tail -10
    echo ""
else
    echo -e "${GREEN}✓${NC} No obvious errors in OpenObserve logs"
fi

echo ""
echo "Step 4: Testing connectivity..."
echo "--------------------------------"

# Test if collector can reach OpenObserve
echo "Testing OTel Collector → OpenObserve connectivity..."
# Try wget first, fall back to curl if not available
HEALTH_CHECK=$(docker compose exec -T otel-collector sh -c 'command -v wget >/dev/null && wget -qO- http://openobserve:5080/healthz || (command -v curl >/dev/null && curl -s http://openobserve:5080/healthz)' 2>&1 || echo "failed")

if echo "$HEALTH_CHECK" | grep -q "ok"; then
    echo -e "${GREEN}✓${NC} OTel Collector can reach OpenObserve"
else
    echo -e "${RED}✗${NC} OTel Collector CANNOT reach OpenObserve"
    echo "  Response: $HEALTH_CHECK"
fi

# Test if apps can reach collector
echo "Testing Node.js app → OTel Collector connectivity..."
# Try wget first, fall back to curl
NODE_CHECK=$(docker compose exec -T nodejs-app sh -c 'command -v wget >/dev/null && wget -qO- http://otel-collector:4318 || (command -v curl >/dev/null && curl -s http://otel-collector:4318)' 2>&1 || echo "failed")
if echo "$NODE_CHECK" | grep -q -E "404|Method Not Allowed"; then
    echo -e "${GREEN}✓${NC} Node.js app can reach OTel Collector"
else
    echo -e "${YELLOW}⚠${NC} Unexpected response from collector (but might be OK)"
fi

echo ""
echo "Step 5: Generating test traffic..."
echo "-----------------------------------"
echo "Sending requests to applications..."

# Generate some traffic
curl -s http://localhost:3000/ > /dev/null && echo -e "${GREEN}✓${NC} Node.js app responding on port 3000" || echo -e "${RED}✗${NC} Node.js app NOT responding"
curl -s http://localhost:3000/api/users > /dev/null && echo -e "${GREEN}✓${NC} Node.js /api/users endpoint responding" || echo -e "${RED}✗${NC} Node.js /api/users NOT responding"
curl -s http://localhost:8000/ > /dev/null && echo -e "${GREEN}✓${NC} Python app responding on port 8000" || echo -e "${RED}✗${NC} Python app NOT responding"
curl -s http://localhost:8000/items/1 > /dev/null && echo -e "${GREEN}✓${NC} Python /items/1 endpoint responding" || echo -e "${RED}✗${NC} Python /items/1 NOT responding"

echo ""
echo "Waiting 5 seconds for telemetry to be exported..."
sleep 5

echo ""
echo "Step 6: Checking if data is being exported..."
echo "----------------------------------------------"

# Check recent collector logs for export activity
EXPORT_LOGS=$(docker compose logs otel-collector --tail=50 --since=10s 2>&1 || true)

if echo "$EXPORT_LOGS" | grep -q -iE "traces|metrics|logs"; then
    echo -e "${GREEN}✓${NC} OTel Collector is processing telemetry data"
    
    # Check for export successes
    if echo "$EXPORT_LOGS" | grep -q -iE "Traces sent|Metrics sent|Logs sent|exporting"; then
        echo -e "${GREEN}✓${NC} Data is being exported to OpenObserve"
    fi
else
    echo -e "${YELLOW}⚠${NC} No recent telemetry activity detected in collector logs"
    echo "  This might mean:"
    echo "  - Applications are not sending telemetry"
    echo "  - Export interval hasn't triggered yet (wait 10-30 seconds)"
fi

echo ""
echo "Step 7: OpenObserve Access Information"
echo "---------------------------------------"
echo -e "${GREEN}OpenObserve UI:${NC} http://localhost:5080"
echo -e "${GREEN}Username:${NC} admin@example.com"
echo -e "${GREEN}Password:${NC} Admin@123"
echo ""
echo "To check for data in OpenObserve:"
echo "  1. Open http://localhost:5080 in your browser"
echo "  2. Login with credentials above"
echo "  3. Navigate to 'Logs', 'Traces', or 'Metrics'"
echo "  4. Set time range to 'Last 1 hour'"
echo "  5. Check the 'Streams' dropdown for:"
echo "     - default (logs stream)"
echo "     - Service-specific streams"
echo "  6. Click 'Run Query' to see data"
echo ""

echo "Step 8: Detailed diagnostics (if still no data)"
echo "------------------------------------------------"
echo "If you still don't see data, run these commands:"
echo ""
echo "# Check actual collector configuration:"
echo "docker compose exec otel-collector cat /etc/otel-collector-config.yaml | grep -A 5 'otlphttp'"
echo ""
echo "# View full collector logs:"
echo "docker compose logs otel-collector --tail=100"
echo ""
echo "# View application logs:"
echo "docker compose logs nodejs-app --tail=50"
echo "docker compose logs python-app --tail=50"
echo ""
echo "# Check OpenObserve streams via API:"
echo "curl -u admin@example.com:Admin@123 http://localhost:5080/api/default/streams"
echo ""
echo "# Enable debug logging in collector:"
echo "# Edit config/otel-collector-config.yaml, change 'level: info' to 'level: debug'"
echo "# Then: docker compose restart otel-collector"
echo ""

echo "========================================="
echo "Diagnostic complete!"
echo "========================================="
