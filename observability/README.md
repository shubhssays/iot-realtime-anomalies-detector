# OpenObserve Local Observability Stack

A complete, production-grade local observability stack using **OpenObserve** with Docker. This stack collects, visualizes, and analyzes **logs**, **metrics**, and **APM traces** for sample applications running locally.

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Architecture Details](#architecture-details)
5. [Configuration Files](#configuration-files)
6. [Sample Applications](#sample-applications)
7. [Viewing Data in OpenObserve](#viewing-data-in-openobserve)
8. [Troubleshooting](#troubleshooting)
9. [Performance & Best Practices](#performance--best-practices)
10. [Advanced Configuration](#advanced-configuration)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Sample Applications                              │
│  ┌──────────────────────┐          ┌──────────────────────┐            │
│  │  Node.js App (3000)  │          │  Python App (8000)   │            │
│  │  + OpenTelemetry SDK │          │  + OpenTelemetry SDK │            │
│  └──────────┬───────────┘          └──────────┬───────────┘            │
│             │                                   │                       │
│             │ OTLP/HTTP (traces, metrics, logs) │                       │
│             └───────────────┬───────────────────┘                       │
└─────────────────────────────┼─────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  OpenTelemetry      │
                    │  Collector (4318)   │
                    │  - Receives data    │
                    │  - Processes/Batches│
                    │  - Exports to O2    │
                    └──────────┬──────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   OpenObserve       │
                    │   (Port 5080)       │
                    │  - Stores data      │
                    │  - Query engine     │
                    │  - Web UI/API       │
                    └─────────────────────┘
```

### Data Flow

1. **Sample Apps** generate telemetry data (traces, metrics, logs) using OpenTelemetry SDKs
2. **OpenTelemetry Collector** receives data via OTLP protocol (HTTP/gRPC)
3. **Collector** processes, batches, and exports data to OpenObserve
4. **OpenObserve** stores and indexes data for querying and visualization
5. **Web UI** accessible at http://localhost:5080 for analysis

---

## 📦 Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Docker** | 20.10+ | Container runtime |
| **Docker Compose** | v2.0+ | Orchestration |
| **curl** | Any | Testing endpoints |
| **System RAM** | 4GB+ recommended | Running all services |
| **System** | Linux/macOS | Development environment |

### Verify Installation

```bash
docker --version
# Docker version 24.0.0 or higher

docker compose version
# Docker Compose version v2.20.0 or higher
```

---

## 🚀 Quick Start

### 1. Clone or Navigate to Repository

```bash
cd /path/to/iot-realtime-anomalies-detector/observability
```

### 2. Start the Stack

```bash
docker compose up -d
```

This starts:
- ✅ OpenObserve (observability platform)
- ✅ OpenTelemetry Collector (data pipeline)
- ✅ Node.js sample app (instrumented)
- ✅ Python sample app (instrumented)
- ✅ Traffic generator (automatic testing)

**Note:** First-time setup downloads images and builds applications, which may take 2-5 minutes depending on your internet connection. OpenObserve takes about 10-15 seconds to fully initialize before other services can connect.

### 3. Verify Services

Wait about 30 seconds for all services to start, then check:

```bash
docker compose ps
```

Expected output:
```
NAME                IMAGE                                    STATUS
nodejs-app          observability-nodejs-app                 Up
openobserve         public.ecr.aws/zinclabs/openobserve      Up
otel-collector      otel/opentelemetry-collector-contrib     Up
python-app          observability-python-app                 Up
traffic-generator   curlimages/curl                          Up
```

### 4. Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **OpenObserve UI** | http://localhost:5080 | Email: `admin@example.com`<br>Password: `Admin@123` |
| **Node.js App** | http://localhost:3000 | None |
| **Python App** | http://localhost:8000 | None |
| **OTel Collector Health** | http://localhost:13133 | None |

### 5. Generate Traffic (Manual)

The stack includes an automatic traffic generator, but you can also generate traffic manually:

```bash
# Test Node.js app
curl http://localhost:3000/
curl http://localhost:3000/api/users
curl http://localhost:3000/api/products
curl http://localhost:3000/api/slow
curl http://localhost:3000/api/error  # Generates error trace

# Test Python app
curl http://localhost:8000/
curl http://localhost:8000/items/1
curl http://localhost:8000/slow
curl http://localhost:8000/error  # Generates error trace
```

### 6. View Data in OpenObserve

1. Open http://localhost:5080 in your browser
2. Login with credentials above
3. Navigate to:
   - **Logs**: View application logs
   - **Traces**: View distributed traces
   - **Metrics**: View application metrics

---

## 🏛️ Architecture Details

### Components

#### 1. OpenObserve
- **Purpose**: Central observability platform
- **Port**: 5080
- **Features**:
  - Unified storage for logs, metrics, and traces
  - Built-in query language (SQL-based)
  - Web UI for visualization
  - REST API for programmatic access
  - Low resource footprint

#### 2. OpenTelemetry Collector
- **Purpose**: Telemetry data pipeline
- **Ports**:
  - 4317: OTLP gRPC receiver
  - 4318: OTLP HTTP receiver
  - 8888: Prometheus metrics (collector's own metrics)
  - 8889: Prometheus exporter
  - 13133: Health check
- **Functions**:
  - Receives telemetry from applications
  - Batches data for efficiency
  - Adds metadata and enrichment
  - Exports to OpenObserve

#### 3. Sample Applications

**Node.js App**
- **Framework**: Express.js
- **Port**: 3000
- **Instrumentation**: Auto-instrumentation via OpenTelemetry SDK
- **Features**:
  - HTTP request tracing
  - Custom metrics (counters, histograms)
  - Structured logging with Pino
  - Error tracking

**Python App**
- **Framework**: FastAPI
- **Port**: 8000
- **Instrumentation**: Auto-instrumentation via OpenTelemetry SDK
- **Features**:
  - Async request handling
  - Automatic trace propagation
  - Custom span attributes
  - Exception tracking

---

## ⚙️ Configuration Files

### 1. Docker Compose (`docker-compose.yml`)

Key configurations:

```yaml
# OpenObserve credentials
environment:
  ZO_ROOT_USER_EMAIL: "admin@example.com"
  ZO_ROOT_USER_PASSWORD: "Admin@123"

# OpenTelemetry Collector endpoint
environment:
  OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318
```

### 2. OpenTelemetry Collector (`config/otel-collector-config.yaml`)

**Receivers**:
- OTLP (gRPC: 4317, HTTP: 4318)
- Prometheus (scrapes collector metrics)

**Processors**:
- `batch`: Batches data (1024 items, 10s timeout)
- `memory_limiter`: Prevents OOM (512MB limit)
- `resource`: Adds environment metadata
- `attributes`: Enriches traces/metrics

**Exporters**:
- `otlphttp/traces`: Exports traces to OpenObserve
- `otlphttp/metrics`: Exports metrics to OpenObserve
- `otlphttp/logs`: Exports logs to OpenObserve
- `debug`: Console output for troubleshooting
- `prometheus`: Exposes metrics on port 8889

**Authentication**:
The collector uses Basic Auth to send data to OpenObserve. The credentials are base64-encoded and set via environment variables.

---

## 📱 Sample Applications

### Node.js Application Structure

```
apps/nodejs-sample/
├── package.json          # Dependencies (Express, OpenTelemetry)
├── tracing.js            # OpenTelemetry SDK setup
├── index.js              # Application code
└── Dockerfile            # Container definition
```

**Key Features**:

1. **Automatic Instrumentation**:
   ```javascript
   const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
   instrumentations: [getNodeAutoInstrumentations()]
   ```

2. **Custom Metrics**:
   ```javascript
   const requestCounter = meter.createCounter('http_requests_total');
   const requestDuration = meter.createHistogram('http_request_duration_seconds');
   ```

3. **Custom Spans**:
   ```javascript
   const span = tracer.startSpan('fetch-users');
   span.setAttribute('users.count', users.length);
   span.end();
   ```

4. **Structured Logging**:
   ```javascript
   logger.info({ method, path, status }, 'Request completed');
   ```

### Python Application Structure

```
apps/python-sample/
├── requirements.txt      # Dependencies (FastAPI, OpenTelemetry)
├── tracing.py            # OpenTelemetry SDK setup
├── main.py               # FastAPI application
└── Dockerfile            # Container definition
```

**Key Features**:

1. **FastAPI Auto-Instrumentation**:
   ```python
   from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
   FastAPIInstrumentor.instrument_app(app)
   ```

2. **Custom Spans with Context Manager**:
   ```python
   with tracer.start_as_current_span("fetch-item") as span:
       span.set_attribute("item.id", item_id)
       span.add_event("Item fetched")
   ```

3. **Exception Tracking**:
   ```python
   try:
       raise ValueError("Error")
   except ValueError as e:
       span.record_exception(e)
       span.set_status(Status(StatusCode.ERROR, str(e)))
   ```

### Endpoints

**Node.js App (http://localhost:3000)**:
- `GET /` - Home page with API info
- `GET /api/users` - Fetch users (with custom span)
- `GET /api/products` - Fetch products
- `GET /api/slow` - Slow endpoint (2-3s delay)
- `GET /api/error` - Intentional error
- `GET /health` - Health check

**Python App (http://localhost:8000)**:
- `GET /` - Home page
- `GET /items/{item_id}` - Get item by ID
- `GET /slow` - Slow endpoint (2-3s delay)
- `GET /error` - Intentional error
- `GET /metrics-demo` - Custom metrics demonstration
- `GET /health` - Health check

---

## 📊 Viewing Data in OpenObserve

### Step 1: Login to OpenObserve

1. Navigate to http://localhost:5080
2. Login with:
   - **Email**: `admin@example.com`
   - **Password**: `Admin@123`

### Step 2: View Logs

1. Click **Logs** in the sidebar
2. Select organization: `default`
3. Select stream: `default` (logs are stored here)
4. You'll see logs from:
   - Node.js app (`nodejs-sample-app`)
   - Python app (`python-sample-app`)
   - OpenTelemetry Collector

**Example Log Query**:
```sql
SELECT * FROM default 
WHERE service_name = 'nodejs-sample-app' 
ORDER BY _timestamp DESC 
LIMIT 100
```

**Filter by log level**:
```sql
SELECT * FROM default 
WHERE level = 'ERROR' 
ORDER BY _timestamp DESC
```

### Step 3: View Traces

1. Click **Traces** in the sidebar
2. Select organization: `default`
3. Select stream: `default`
4. You'll see distributed traces showing:
   - Request flow through services
   - Span durations
   - Parent-child relationships
   - Errors and exceptions

**Trace Features**:
- **Timeline View**: Visual representation of spans
- **Waterfall View**: Hierarchical span relationships
- **Span Details**: Attributes, events, exceptions
- **Error Highlighting**: Failed spans in red

**Example Traces to Look For**:
- `/api/users` - Shows custom span "fetch-users"
- `/api/error` - Shows error trace with exception details
- `/api/slow` - Shows slow operation with 2-3s duration

### Step 4: View Metrics

1. Click **Metrics** in the sidebar
2. Select organization: `default`
3. Select stream: `default`
4. Available metrics:
   - `http_requests_total` - Request counter
   - `http_request_duration_seconds` - Request latency
   - `http_requests_active` - Active requests gauge

**Example Metric Queries**:

**Request rate by service**:
```
rate(http_requests_total[5m])
```

**Average request duration**:
```
avg(http_request_duration_seconds)
```

**Request count by status code**:
```
sum by (status) (http_requests_total)
```

### Step 5: Create Dashboards

1. Go to **Dashboards**
2. Click **Create Dashboard**
3. Add panels:
   - **Logs Panel**: Recent errors
   - **Trace Panel**: Request latency
   - **Metrics Panel**: Request rate over time

**Example Dashboard Panels**:

1. **Error Rate**:
   ```
   sum(rate(http_requests_total{status=~"5.."}[5m]))
   ```

2. **P95 Latency**:
   ```
   histogram_quantile(0.95, http_request_duration_seconds)
   ```

3. **Active Requests**:
   ```
   sum(http_requests_active)
   ```

---

## 🔧 Troubleshooting

### Issue 1: Services Not Starting

**Symptoms**:
- Containers exit immediately
- `docker compose ps` shows unhealthy services

**Solutions**:

```bash
# Check logs
docker compose logs openobserve
docker compose logs otel-collector

# Restart specific service
docker compose restart openobserve

# Rebuild and restart
docker compose up -d --build
```

### Issue 2: No Data in OpenObserve

**Symptoms**:
- OpenObserve UI is empty
- No logs, traces, or metrics visible

**Common Cause**: Wrong OTLP endpoint paths in collector configuration

OpenObserve requires `/otlp/v1/` in the OTLP endpoint paths. Check your `config/otel-collector-config.yaml`:

```yaml
exporters:
  otlphttp/traces:
    # ✅ CORRECT: includes /otlp/v1/
    endpoint: ${OPENOBSERVE_URL}/api/${OPENOBSERVE_ORG}/otlp/v1/traces
    
    # ❌ WRONG: missing /otlp/v1/
    # endpoint: ${OPENOBSERVE_URL}/api/${OPENOBSERVE_ORG}/traces
```

**Quick Check**:
```bash
# Look for 404 errors in collector logs
docker compose logs otel-collector | grep "404"

# If you see 404 errors, the endpoint paths are wrong
```

**Diagnostic Steps**:

1. **Check if apps are sending data**:
   ```bash
   # Check collector logs for incoming data
   docker compose logs otel-collector | grep -i "traces"
   docker compose logs otel-collector | grep -i "metrics"
   docker compose logs otel-collector | grep -i "logs"
   ```

2. **Verify collector can reach OpenObserve**:
   ```bash
   # Check OpenObserve health from collector
   docker compose exec otel-collector wget -O- http://openobserve:5080/healthz
   ```

3. **Check authentication**:
   ```bash
   # Verify credentials work
   curl -u admin@example.com:Admin@123 http://localhost:5080/api/default/_search
   ```

4. **Enable debug logging**:
   Edit `config/otel-collector-config.yaml`:
   ```yaml
   service:
     telemetry:
       logs:
         level: debug  # Change from 'info' to 'debug'
   ```
   Then restart: `docker compose restart otel-collector`

### Issue 3: Authentication Errors

**Symptoms**:
- Collector logs show 401 errors
- "Unauthorized" messages in logs

**Solution**:

The collector uses Basic Auth. Verify the environment variables:

```bash
# Check collector environment
docker compose exec otel-collector env | grep OPENOBSERVE

# Should show:
# OPENOBSERVE_URL=http://openobserve:5080
# OPENOBSERVE_USER=admin@example.com
# OPENOBSERVE_PASSWORD=Admin@123
```

**Note**: The collector config references `${OPENOBSERVE_AUTH}` which should be base64-encoded `user:password`. Update the config:

```yaml
headers:
  Authorization: "Basic ${OPENOBSERVE_AUTH}"
```

Generate the auth token:
```bash
echo -n "admin@example.com:Admin@123" | base64
# Output: YWRtaW5AZXhhbXBsZS5jb206QWRtaW5AMTIz
```

Then add to docker-compose.yml:
```yaml
otel-collector:
  environment:
    - OPENOBSERVE_AUTH=YWRtaW5AZXhhbXBsZS5jb206QWRtaW5AMTIz
```

### Issue 4: Port Conflicts

**Symptoms**:
- "port already allocated" errors
- Services fail to start

**Solution**:

```bash
# Check which process is using a port
sudo lsof -i :5080
sudo lsof -i :4318

# Change port in docker-compose.yml
ports:
  - "5081:5080"  # Use 5081 instead of 5080
```

### Issue 5: Collector Not Exporting

**Symptoms**:
- Apps are instrumented but no data in OpenObserve
- Collector logs show "exporter errors"

**Diagnostic Steps**:

1. **Check collector health**:
   ```bash
   curl http://localhost:13133
   ```

2. **Verify collector can resolve OpenObserve**:
   ```bash
   docker compose exec otel-collector ping -c 3 openobserve
   ```

3. **Test OTLP endpoint manually**:
   ```bash
   # Send test trace
   curl -X POST http://localhost:4318/v1/traces \
     -H "Content-Type: application/json" \
     -d '{
       "resourceSpans": [{
         "resource": {
           "attributes": [{"key": "service.name", "value": {"stringValue": "test"}}]
         },
         "scopeSpans": [{
           "spans": [{
             "traceId": "12345678901234567890123456789012",
             "spanId": "1234567890123456",
             "name": "test-span",
             "kind": 1,
             "startTimeUnixNano": "1234567890000000000",
             "endTimeUnixNano": "1234567891000000000"
           }]
         }]
       }]
     }'
   ```

### Issue 6: High Memory Usage

**Symptoms**:
- Docker containers using excessive memory
- System slowdown

**Solutions**:

1. **Reduce batch size** in `otel-collector-config.yaml`:
   ```yaml
   batch:
     timeout: 5s
     send_batch_size: 512  # Reduced from 1024
     send_batch_max_size: 1024  # Reduced from 2048
   ```

2. **Lower memory limit**:
   ```yaml
   memory_limiter:
     limit_mib: 256  # Reduced from 512
   ```

3. **Set Docker resource limits** in `docker-compose.yml`:
   ```yaml
   otel-collector:
     mem_limit: 512m
     cpus: 0.5
   ```

### Issue 7: Missing Traces/Spans

**Symptoms**:
- Some traces appear, others don't
- Incomplete span hierarchies

**Possible Causes**:

1. **Sampling**: Check if sampling is enabled
2. **Context Propagation**: Ensure trace context is propagated correctly
3. **Network Issues**: Collector may drop data under load

**Solutions**:

1. **Disable sampling** (for local dev):
   ```javascript
   // Node.js tracing.js
   const sdk = new NodeSDK({
     sampler: new AlwaysOnSampler(),  // Add this
   });
   ```

2. **Check span processor**:
   ```javascript
   // Use BatchSpanProcessor with lower limits
   const processor = new BatchSpanProcessor(exporter, {
     maxQueueSize: 100,
     maxExportBatchSize: 10,
     scheduledDelayMillis: 500,
   });
   ```

### Issue 8: Apps Can't Connect to Collector

**Symptoms**:
- App logs show connection refused
- No data reaching collector

**Solution**:

```bash
# Verify collector is accessible from app container
docker compose exec nodejs-app ping -c 3 otel-collector
docker compose exec nodejs-app nc -zv otel-collector 4318

# Check network
docker network inspect observability_observability-network
```

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `connection refused` | Service not running | Start service: `docker compose up -d` |
| `401 Unauthorized` | Wrong credentials | Check `ZO_ROOT_USER_*` env vars |
| `404 Not Found` | Wrong endpoint | Verify URL: `/api/default/traces` |
| `timeout` | Network issue | Check `docker network ls` |
| `OOM killed` | Out of memory | Increase Docker memory limit |

---

## ⚡ Performance & Best Practices

### 1. Resource Allocation

**Minimum Requirements**:
- CPU: 2 cores
- RAM: 4GB
- Disk: 10GB

**Recommended for Production**:
- CPU: 4+ cores
- RAM: 8GB+
- Disk: 50GB+ (SSD preferred)

**Docker Settings**:
```yaml
# docker-compose.yml
services:
  openobserve:
    mem_limit: 2g
    cpus: 1.0
  
  otel-collector:
    mem_limit: 512m
    cpus: 0.5
```

### 2. Batching Configuration

**Current Settings** (good for local):
```yaml
batch:
  timeout: 10s
  send_batch_size: 1024
  send_batch_max_size: 2048
```

**High-throughput Settings**:
```yaml
batch:
  timeout: 5s
  send_batch_size: 2048
  send_batch_max_size: 4096
```

**Low-latency Settings**:
```yaml
batch:
  timeout: 1s
  send_batch_size: 100
  send_batch_max_size: 500
```

### 3. Sampling Strategies

**For Local Development** (capture everything):
```javascript
// Always sample all traces
sampler: new AlwaysOnSampler()
```

**For Production** (reduce volume):
```javascript
// Sample 10% of traces
sampler: new TraceIdRatioBasedSampler(0.1)

// Or use parent-based sampling
sampler: new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(0.1)
})
```

### 4. Data Retention

**OpenObserve Data Retention**:

By default, OpenObserve keeps all data. For local dev, you may want to limit retention:

```bash
# Set retention policy via API
curl -X PUT http://localhost:5080/api/default/settings \
  -u admin@example.com:Admin@123 \
  -H "Content-Type: application/json" \
  -d '{
    "data_retention_days": 7
  }'
```

### 5. Index Optimization

**For better query performance**:

1. Use time-based queries
2. Filter early in queries
3. Limit result sets
4. Use appropriate aggregations

**Example Optimized Query**:
```sql
-- Good: Filter early, limit results
SELECT * FROM default 
WHERE _timestamp > now() - interval '1 hour'
  AND service_name = 'nodejs-sample-app'
  AND level = 'ERROR'
ORDER BY _timestamp DESC 
LIMIT 100

-- Bad: Full scan without filters
SELECT * FROM default 
ORDER BY _timestamp DESC
```

### 6. Collector Scaling

**Vertical Scaling** (single collector):
```yaml
otel-collector:
  mem_limit: 2g
  cpus: 2.0
  environment:
    - GOMAXPROCS=2
```

**Horizontal Scaling** (multiple collectors):
```yaml
otel-collector-1:
  # ... collector config
  
otel-collector-2:
  # ... collector config
  
# Use load balancer to distribute traffic
nginx:
  # ... nginx config for load balancing
```

### 7. Network Optimization

**Use gRPC instead of HTTP** (better performance):

```javascript
// Node.js - use gRPC exporter
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');

const exporter = new OTLPTraceExporter({
  url: 'grpc://otel-collector:4317',
});
```

```yaml
# Update docker-compose.yml
nodejs-app:
  environment:
    - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
    - OTEL_EXPORTER_OTLP_PROTOCOL=grpc  # Change from http/protobuf
```

### 8. Monitoring the Monitoring Stack

**Collector Metrics**:
- Endpoint: http://localhost:8888/metrics
- Exposed metrics:
  - `otelcol_receiver_accepted_spans`
  - `otelcol_receiver_refused_spans`
  - `otelcol_exporter_sent_spans`
  - `otelcol_exporter_send_failed_spans`

**Monitor with Prometheus**:
```yaml
# Add Prometheus to monitor the collector
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"
```

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'otel-collector'
    static_configs:
      - targets: ['otel-collector:8888']
```

### 9. Security Best Practices

**Change Default Credentials**:
```yaml
openobserve:
  environment:
    ZO_ROOT_USER_EMAIL: "your-email@company.com"
    ZO_ROOT_USER_PASSWORD: "YourStrongPassword123!"
```

**Use Secrets Management**:
```yaml
# docker-compose.yml
secrets:
  openobserve_password:
    file: ./secrets/openobserve_password.txt

services:
  openobserve:
    secrets:
      - openobserve_password
    environment:
      ZO_ROOT_USER_PASSWORD_FILE: /run/secrets/openobserve_password
```

**Enable TLS** (for production):
```yaml
otel-collector:
  volumes:
    - ./certs:/certs
  environment:
    - OTEL_EXPORTER_OTLP_CERTIFICATE=/certs/ca.crt
```

---

## 🔬 Advanced Configuration

### Custom Collector Processors

**Add filtering**:
```yaml
processors:
  # Filter out health check traces
  filter/healthcheck:
    traces:
      span:
        - 'attributes["http.target"] == "/health"'
```

**Add tail-based sampling**:
```yaml
processors:
  # Sample based on span attributes
  tail_sampling:
    policies:
      - name: error-traces
        type: status_code
        status_code: {status_codes: [ERROR]}
      - name: slow-traces
        type: latency
        latency: {threshold_ms: 1000}
      - name: random-sample
        type: probabilistic
        probabilistic: {sampling_percentage: 10}
```

### Custom Metrics

**Add business metrics**:

```javascript
// Node.js
const orderCounter = meter.createCounter('orders_total', {
  description: 'Total number of orders',
});

app.post('/orders', (req, res) => {
  // Process order
  orderCounter.add(1, {
    product: req.body.product,
    region: req.body.region,
  });
  res.json({ success: true });
});
```

### Span Links

**Link related spans**:

```javascript
const span1 = tracer.startSpan('operation-1');
const span1Context = span1.spanContext();
span1.end();

const span2 = tracer.startSpan('operation-2', {
  links: [{ context: span1Context }]
});
span2.end();
```

### Baggage Propagation

**Share data across services**:

```javascript
const { propagation, context } = require('@opentelemetry/api');

// Set baggage
const ctx = propagation.setBaggage(
  context.active(),
  propagation.createBaggage({
    'user.id': { value: '12345' },
    'tenant.id': { value: 'acme-corp' },
  })
);

// Baggage automatically propagates to downstream services
```

---

## 📚 Additional Resources

### Documentation
- [OpenObserve Docs](https://openobserve.ai/docs/)
- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)

### Example Queries

**Find slow requests**:
```sql
SELECT * FROM default 
WHERE http_request_duration_seconds > 1.0
ORDER BY _timestamp DESC
```

**Group errors by service**:
```sql
SELECT service_name, COUNT(*) as error_count
FROM default 
WHERE level = 'ERROR'
GROUP BY service_name
```

**Calculate request rate**:
```sql
SELECT 
  service_name,
  COUNT(*) / 60.0 as requests_per_second
FROM default 
WHERE _timestamp > now() - interval '1 minute'
  AND http_method IS NOT NULL
GROUP BY service_name
```

---

## 🧹 Cleanup

### Stop Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (deletes all data)
docker compose down -v

# Stop and remove images
docker compose down --rmi all
```

### Remove Everything

```bash
# Complete cleanup
docker compose down -v --rmi all --remove-orphans

# Remove dangling volumes
docker volume prune -f

# Remove dangling images
docker image prune -af
```

---

## 📝 Summary

This observability stack provides:

✅ **Complete Observability**: Logs, metrics, and traces in one place  
✅ **Production-Ready**: Based on industry-standard OpenTelemetry  
✅ **Easy to Use**: Docker Compose orchestration, minimal configuration  
✅ **Performant**: Optimized batching and processing  
✅ **Extensible**: Add custom metrics, processors, exporters  
✅ **Well-Documented**: Comprehensive guides and troubleshooting  

### Next Steps

1. **Customize**: Modify apps to match your tech stack
2. **Integrate**: Connect your actual services
3. **Scale**: Add more collectors, optimize resources
4. **Secure**: Implement TLS, rotate credentials
5. **Monitor**: Set up alerts and dashboards

---

## 🤝 Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review collector logs: `docker compose logs otel-collector`
3. Check OpenObserve logs: `docker compose logs openobserve`
4. Verify configuration files are correctly formatted

---

**Built with ❤️ for local observability**
