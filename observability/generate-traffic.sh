#!/bin/bash
#
# Traffic Generator Script
# Generates sample HTTP traffic to test the observability stack
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "Traffic Generator"
echo "========================================="
echo ""
echo "Generating traffic to sample applications..."
echo "Press Ctrl+C to stop"
echo ""

# Counter
count=0

while true; do
    count=$((count + 1))
    echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} Sending requests batch #$count"
    
    # Node.js App
    echo -n "  Node.js: "
    curl -s http://localhost:3000/ > /dev/null 2>&1 && echo -n "✓ / "
    curl -s http://localhost:3000/api/users > /dev/null 2>&1 && echo -n "✓ /api/users "
    curl -s http://localhost:3000/api/products > /dev/null 2>&1 && echo -n "✓ /api/products "
    
    # Occasionally hit error endpoint
    if [ $((count % 10)) -eq 0 ]; then
        curl -s http://localhost:3000/api/error > /dev/null 2>&1 && echo -n "✓ /api/error " || echo -n "✗ /api/error "
    fi
    
    # Occasionally hit slow endpoint
    if [ $((count % 5)) -eq 0 ]; then
        curl -s http://localhost:3000/api/slow > /dev/null 2>&1 && echo -n "✓ /api/slow "
    fi
    
    echo ""
    
    # Python App
    echo -n "  Python:  "
    curl -s http://localhost:8000/ > /dev/null 2>&1 && echo -n "✓ / "
    curl -s http://localhost:8000/items/1 > /dev/null 2>&1 && echo -n "✓ /items/1 "
    curl -s http://localhost:8000/items/2 > /dev/null 2>&1 && echo -n "✓ /items/2 "
    
    # Occasionally hit error endpoint
    if [ $((count % 10)) -eq 0 ]; then
        curl -s http://localhost:8000/error > /dev/null 2>&1 && echo -n "✓ /error " || echo -n "✗ /error "
    fi
    
    # Occasionally hit slow endpoint
    if [ $((count % 5)) -eq 0 ]; then
        curl -s http://localhost:8000/slow > /dev/null 2>&1 && echo -n "✓ /slow "
    fi
    
    echo ""
    echo ""
    
    # Wait before next batch
    sleep 5
done
