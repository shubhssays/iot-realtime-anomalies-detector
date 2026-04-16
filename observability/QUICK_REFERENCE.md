# Quick Reference - OpenObserve Observability Stack

## Quick Commands

```bash
# Start the stack
docker compose up -d

# Stop the stack
docker compose down

# Stop and remove all data
docker compose down -v

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f openobserve

# Restart a service
docker compose restart openobserve

# Check service status
docker compose ps

# Generate traffic manually
./generate-traffic.sh
```

## URLs & Credentials

| Service | URL | Credentials |
|---------|-----|-------------|
| **OpenObserve UI** | http://localhost:5080 | Email: `admin@example.com`<br>Password: `Admin@123` |
| **Node.js App** | http://localhost:3000 | None |
| **Python App** | http://localhost:8000 | None |
| **OTel Collector Health** | http://localhost:13133 | None |
| **OTel Collector Metrics** | http://localhost:8888/metrics | None |
| **OTel Collector zpages** | http://localhost:55679/debug/tracez | None |

## Port Reference

| Port | Service | Protocol | Purpose |
|------|---------|----------|---------|
| 5080 | OpenObserve | HTTP | Web UI & API |
| 4317 | OTel Collector | gRPC | OTLP gRPC receiver |
| 4318 | OTel Collector | HTTP | OTLP HTTP receiver |
| 8888 | OTel Collector | HTTP | Prometheus metrics (own) |
| 8889 | OTel Collector | HTTP | Prometheus exporter |
| 13133 | OTel Collector | HTTP | Health check |
| 55679 | OTel Collector | HTTP | zpages diagnostics |
| 3000 | Node.js App | HTTP | Sample application |
| 8000 | Python App | HTTP | Sample application |

## Sample Endpoints

### Node.js App (http://localhost:3000)

```bash
# Home page
curl http://localhost:3000/

# Users API
curl http://localhost:3000/api/users

# Products API
curl http://localhost:3000/api/products

# Slow endpoint (2-3s)
curl http://localhost:3000/api/slow

# Error endpoint
curl http://localhost:3000/api/error

# Health check
curl http://localhost:3000/health
```

### Python App (http://localhost:8000)

```bash
# Home page
curl http://localhost:8000/

# Get item by ID
curl http://localhost:8000/items/1
curl http://localhost:8000/items/2

# Slow endpoint (2-3s)
curl http://localhost:8000/slow

# Error endpoint
curl http://localhost:8000/error

# Metrics demo
curl http://localhost:8000/metrics-demo

# Health check
curl http://localhost:8000/health
```

## OpenObserve Query Examples

### Logs

```sql
-- Recent logs from Node.js app
SELECT * FROM default 
WHERE service_name = 'nodejs-sample-app'
  AND _timestamp > now() - interval '1 hour'
ORDER BY _timestamp DESC 
LIMIT 100

-- Error logs from all services
SELECT * FROM default 
WHERE level = 'ERROR'
  AND _timestamp > now() - interval '1 hour'
ORDER BY _timestamp DESC

-- Logs by service and level
SELECT service_name, level, COUNT(*) as count
FROM default 
WHERE _timestamp > now() - interval '1 hour'
GROUP BY service_name, level

-- Search for specific text
SELECT * FROM default 
WHERE body LIKE '%error%'
  AND _timestamp > now() - interval '1 hour'
ORDER BY _timestamp DESC 
LIMIT 50
```

### Traces

Filter traces in the UI by:
- Service name: `nodejs-sample-app` or `python-sample-app`
- Operation: `/api/users`, `/items/{item_id}`, etc.
- Duration: `> 1000ms` (for slow requests)
- Status: `ERROR` (for failed requests)

### Metrics

```
# Request rate (requests per second)
rate(http_requests_total[5m])

# Request rate by service
sum by (service_name) (rate(http_requests_total[5m]))

# Error rate
sum(rate(http_requests_total{status=~"5.."}[5m]))

# P95 latency
histogram_quantile(0.95, http_request_duration_seconds)

# Average request duration
avg(http_request_duration_seconds)

# Active requests
sum(http_requests_active)
```

## Environment Variables

### OpenObserve

```bash
ZO_ROOT_USER_EMAIL=admin@example.com
ZO_ROOT_USER_PASSWORD=Admin@123
ZO_DATA_DIR=/data
ZO_HTTP_PORT=5080
```

### OpenTelemetry Collector

```bash
OPENOBSERVE_URL=http://openobserve:5080
OPENOBSERVE_ORG=default
OPENOBSERVE_USER=admin@example.com
OPENOBSERVE_PASSWORD=Admin@123
OPENOBSERVE_AUTH=YWRtaW5AZXhhbXBsZS5jb206QWRtaW5AMTIz
```

### Applications

```bash
OTEL_SERVICE_NAME=nodejs-sample-app
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_RESOURCE_ATTRIBUTES=service.name=nodejs-sample-app,service.version=1.0.0
```

## File Structure

```
observability/
├── README.md                          # Main documentation
├── TROUBLESHOOTING.md                 # Troubleshooting guide
├── QUICK_REFERENCE.md                 # This file
├── docker-compose.yml                 # Docker Compose configuration
├── setup.sh                           # Setup script
├── generate-traffic.sh                # Traffic generator script
├── .env.example                       # Environment variables template
├── config/
│   └── otel-collector-config.yaml    # OpenTelemetry Collector config
└── apps/
    ├── nodejs-sample/
    │   ├── package.json
    │   ├── tracing.js                # OTel SDK setup
    │   ├── index.js                  # Application code
    │   └── Dockerfile
    └── python-sample/
        ├── requirements.txt
        ├── tracing.py                # OTel SDK setup
        ├── main.py                   # Application code
        └── Dockerfile
```

## Useful Docker Commands

```bash
# View resource usage
docker stats

# Inspect a container
docker inspect openobserve

# Execute command in container
docker compose exec openobserve sh

# View container IP addresses
docker compose exec openobserve hostname -i

# Copy file from container
docker compose cp openobserve:/data/logs.txt ./logs.txt

# View network details
docker network inspect observability_observability-network

# View volume details
docker volume inspect observability_openobserve_data

# Remove unused volumes
docker volume prune

# Remove unused images
docker image prune -a
```

## Debugging Commands

```bash
# Test collector health
curl http://localhost:13133

# Test OpenObserve health
curl http://localhost:5080/healthz

# Test OpenObserve API with auth
curl -u admin@example.com:Admin@123 \
  http://localhost:5080/api/default/_search

# Check collector can reach OpenObserve
docker compose exec otel-collector wget -O- http://openobserve:5080/healthz

# Check app can reach collector
docker compose exec nodejs-app nc -zv otel-collector 4318

# View collector metrics
curl http://localhost:8888/metrics

# View collector zpages (traces)
curl http://localhost:55679/debug/tracez

# Send test trace to collector
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"test"}}]},"scopeSpans":[{"spans":[{"traceId":"12345678901234567890123456789012","spanId":"1234567890123456","name":"test-span","kind":1,"startTimeUnixNano":"1234567890000000000","endTimeUnixNano":"1234567891000000000"}]}]}]}'
```

## Common Issues & Quick Fixes

### No data in OpenObserve
```bash
# Check collector logs for errors
docker compose logs otel-collector | grep -i error

# Restart collector
docker compose restart otel-collector

# Regenerate auth token
echo -n "admin@example.com:Admin@123" | base64
# Add to .env: OPENOBSERVE_AUTH=<output>
```

### Port conflict
```bash
# Find process using port
sudo lsof -i :5080

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
```

### Out of memory
```bash
# Check memory usage
docker stats

# Add memory limits to docker-compose.yml
# mem_limit: 1g

# Restart with limits
docker compose down && docker compose up -d
```

### Services not starting
```bash
# View logs
docker compose logs

# Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Data Management

```bash
# Clear all data (keep config)
docker compose down -v

# Backup OpenObserve data
docker compose exec openobserve tar -czf /tmp/backup.tar.gz /data
docker compose cp openobserve:/tmp/backup.tar.gz ./backup.tar.gz

# Restore OpenObserve data
docker compose cp ./backup.tar.gz openobserve:/tmp/backup.tar.gz
docker compose exec openobserve tar -xzf /tmp/backup.tar.gz -C /

# Export logs to file
docker compose logs > all-logs-$(date +%Y%m%d-%H%M%S).txt
```

## Performance Tuning

### Reduce memory usage
```yaml
# otel-collector-config.yaml
processors:
  batch:
    send_batch_size: 512      # Lower from 1024
  memory_limiter:
    limit_mib: 256            # Lower from 512
```

### Reduce CPU usage
```yaml
# docker-compose.yml
services:
  otel-collector:
    cpus: 0.5                 # Limit CPU
```

### Increase throughput
```yaml
# otel-collector-config.yaml
processors:
  batch:
    timeout: 5s               # Lower from 10s
    send_batch_size: 2048     # Increase from 1024
```

## Monitoring the Stack

```bash
# Watch container status
watch docker compose ps

# Monitor resource usage in real-time
docker stats

# Follow all logs
docker compose logs -f

# Follow specific service
docker compose logs -f openobserve

# Count log entries
docker compose logs | wc -l

# Search logs
docker compose logs | grep -i "error"
```

---

**Quick Setup:**

```bash
cd observability
./setup.sh
# Wait ~30 seconds
# Open http://localhost:5080
# Login: admin@example.com / Admin@123
```

**Quick Teardown:**

```bash
docker compose down -v
```
