# Troubleshooting Guide - OpenObserve Observability Stack

This guide covers common issues and their solutions.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [Debugging Checklist](#debugging-checklist)
4. [Log Analysis](#log-analysis)
5. [Performance Issues](#performance-issues)
6. [Getting Help](#getting-help)

---

## Quick Diagnostics

### Health Check All Services

```bash
# Check all services
docker compose ps

# Expected: All services should be "Up" or "Up (healthy)"
```

### Check Logs

```bash
# All services
docker compose logs

# Specific service
docker compose logs openobserve
docker compose logs otel-collector
docker compose logs nodejs-app
docker compose logs python-app

# Follow logs in real-time
docker compose logs -f openobserve
```

### Test Endpoints

```bash
# OpenObserve health
curl http://localhost:5080/healthz
# Expected: {"status":"ok"}

# OTel Collector health
curl http://localhost:13133
# Expected: HTTP 200

# Node.js app
curl http://localhost:3000/health
# Expected: {"status":"healthy",...}

# Python app
curl http://localhost:8000/health
# Expected: {"status":"healthy",...}
```

---

## Common Issues

### Issue 1: "Container openobserve is unhealthy" or "dependency failed to start"

**Symptoms:**
- Error during `docker compose up`: `dependency failed to start: container openobserve is unhealthy`
- Services fail to start because OpenObserve appears unhealthy

**Cause:**
This was an issue in earlier versions where the healthcheck used `wget` which wasn't available in the OpenObserve container. This has been fixed by removing the healthcheck.

**Solutions:**

1. **Update to latest version:**
   ```bash
   git pull
   ```

2. **If still seeing issues, give OpenObserve time to start:**
   OpenObserve takes about 10-15 seconds to fully initialize. The collector and apps will start once OpenObserve is running.

3. **Manual startup approach:**
   ```bash
   # Start OpenObserve first
   docker compose up -d openobserve
   
   # Wait 15 seconds
   sleep 15
   
   # Start remaining services
   docker compose up -d
   ```

4. **Verify OpenObserve is running:**
   ```bash
   curl http://localhost:5080/healthz
   # Should return: {"status":"ok"}
   ```

### Issue 2: "Cannot connect to OpenObserve"

**Symptoms:**
- Cannot access http://localhost:5080
- Browser shows "Connection refused"

**Solutions:**

1. **Check if OpenObserve is running:**
   ```bash
   docker compose ps openobserve
   ```

2. **Check OpenObserve logs:**
   ```bash
   docker compose logs openobserve
   ```

3. **Restart OpenObserve:**
   ```bash
   docker compose restart openobserve
   ```

4. **Check port binding:**
   ```bash
   # See if port 5080 is in use
   sudo lsof -i :5080
   
   # If port is taken, change port in docker-compose.yml:
   # ports:
   #   - "5081:5080"
   ```

5. **Full restart:**
   ```bash
   docker compose down
   docker compose up -d
   ```

---

### Issue 3: "No data appearing in OpenObserve"

**Symptoms:**
- OpenObserve UI is empty
- No logs, traces, or metrics visible

**Diagnostic Steps:**

1. **Verify apps are sending data:**
   ```bash
   # Check app logs for OpenTelemetry initialization
   docker compose logs nodejs-app | grep -i "opentelemetry"
   docker compose logs python-app | grep -i "opentelemetry"
   
   # Expected output:
   # "OpenTelemetry SDK started successfully"
   # "OpenTelemetry SDK initialized"
   ```

2. **Check collector is receiving data:**
   ```bash
   docker compose logs otel-collector | grep -i "traces"
   docker compose logs otel-collector | grep -i "metrics"
   docker compose logs otel-collector | grep -i "logs"
   ```

3. **Verify collector can reach OpenObserve:**
   ```bash
   docker compose exec otel-collector wget -O- http://openobserve:5080/healthz
   # Expected: {"status":"ok"}
   ```

4. **Check authentication:**
   ```bash
   # Test OpenObserve API
   curl -u admin@example.com:Admin@123 \
     http://localhost:5080/api/default/_search
   ```

5. **Enable debug logging in collector:**
   
   Edit `config/otel-collector-config.yaml`:
   ```yaml
   service:
     telemetry:
       logs:
         level: debug  # Change from 'info'
   ```
   
   Restart collector:
   ```bash
   docker compose restart otel-collector
   docker compose logs -f otel-collector
   ```

6. **Check for export errors:**
   ```bash
   docker compose logs otel-collector | grep -i "error\|failed"
   ```

**Common Causes:**

- **Wrong OTLP endpoint paths**: OpenObserve requires `/otlp/v1/` in the path (e.g., `/api/default/otlp/v1/traces` not `/api/default/traces`)
- **Wrong credentials**: Check `ZO_ROOT_USER_EMAIL` and `ZO_ROOT_USER_PASSWORD` in docker-compose.yml
- **Network issue**: Ensure all services are on the same Docker network
- **Collector misconfiguration**: Verify `otel-collector-config.yaml` syntax
- **OpenObserve not ready**: Wait 30 seconds after starting for initialization

**Quick Fix for OTLP Endpoint Issue:**

If you see errors like "404 Not Found" in the collector logs, the OTLP endpoints may be wrong:

```bash
# Check collector logs for 404 errors
docker compose logs otel-collector | grep "404"

# If found, verify endpoints in config/otel-collector-config.yaml
# Should be:
#   /api/default/otlp/v1/traces
#   /api/default/otlp/v1/metrics
#   /api/default/otlp/v1/logs
# NOT:
#   /api/default/traces
#   /api/default/metrics
#   /api/default/logs
```

---

### Issue 4: "401 Unauthorized" errors in collector logs

**Symptoms:**
- Collector logs show "401 Unauthorized"
- Data not reaching OpenObserve

**Solution:**

The collector needs proper authentication. Update the collector configuration:

1. **Generate Base64 auth token:**
   ```bash
   echo -n "admin@example.com:Admin@123" | base64
   # Output: YWRtaW5AZXhhbXBsZS5jb206QWRtaW5AMTIz
   ```

2. **Add to docker-compose.yml:**
   ```yaml
   otel-collector:
     environment:
       - OPENOBSERVE_AUTH=YWRtaW5AZXhhbXBsZS5jb206QWRtaW5AMTIz
   ```

3. **Verify in collector config:**
   ```yaml
   exporters:
     otlphttp/traces:
       endpoint: ${OPENOBSERVE_URL}/api/${OPENOBSERVE_ORG}/traces
       headers:
         Authorization: "Basic ${OPENOBSERVE_AUTH}"
   ```

4. **Restart:**
   ```bash
   docker compose restart otel-collector
   ```

---

### Issue 5: "Port already in use"

**Symptoms:**
- Error: "Bind for 0.0.0.0:5080 failed: port is already allocated"
- Services fail to start

**Solution:**

1. **Find what's using the port:**
   ```bash
   sudo lsof -i :5080
   sudo lsof -i :4318
   sudo lsof -i :3000
   sudo lsof -i :8000
   ```

2. **Kill the process:**
   ```bash
   # Replace PID with actual process ID
   kill -9 <PID>
   ```

3. **Or change ports in docker-compose.yml:**
   ```yaml
   openobserve:
     ports:
       - "5081:5080"  # Use 5081 instead
   
   nodejs-app:
     ports:
       - "3001:3000"  # Use 3001 instead
   ```

4. **Restart:**
   ```bash
   docker compose up -d
   ```

---

### Issue 6: "High memory usage / OOM kills"

**Symptoms:**
- Containers restart frequently
- System becomes slow
- "OOMKilled" in `docker compose ps`

**Solutions:**

1. **Check memory usage:**
   ```bash
   docker stats
   ```

2. **Reduce collector batch size** (in `config/otel-collector-config.yaml`):
   ```yaml
   processors:
     batch:
       timeout: 5s
       send_batch_size: 512      # Reduced
       send_batch_max_size: 1024  # Reduced
     
     memory_limiter:
       limit_mib: 256    # Reduced
       spike_limit_mib: 64  # Reduced
   ```

3. **Add memory limits to docker-compose.yml:**
   ```yaml
   services:
     openobserve:
       mem_limit: 1g
       mem_reservation: 512m
     
     otel-collector:
       mem_limit: 512m
       mem_reservation: 256m
     
     nodejs-app:
       mem_limit: 256m
     
     python-app:
       mem_limit: 256m
   ```

4. **Reduce traffic generation:**
   
   Edit docker-compose.yml and increase sleep time in traffic-generator:
   ```yaml
   traffic-generator:
     command:
       - |
         # ... existing script
         sleep 10  # Increased from 5
   ```

5. **Restart with limits:**
   ```bash
   docker compose down
   docker compose up -d
   ```

---

### Issue 7: "Collector not exporting data"

**Symptoms:**
- Apps are instrumented
- Collector receives data
- No data in OpenObserve

**Diagnostic Steps:**

1. **Check collector exporters:**
   ```bash
   docker compose logs otel-collector | grep -i "exporter"
   ```

2. **Verify OpenObserve endpoint:**
   ```bash
   # From collector, test OpenObserve
   docker compose exec otel-collector sh -c "
     wget -O- http://openobserve:5080/healthz
   "
   ```

3. **Check network connectivity:**
   ```bash
   # Verify collector can resolve OpenObserve
   docker compose exec otel-collector ping -c 3 openobserve
   ```

4. **Test OTLP endpoint manually:**
   ```bash
   curl -X POST http://localhost:4318/v1/traces \
     -H "Content-Type: application/json" \
     -d '{
       "resourceSpans": [{
         "resource": {
           "attributes": [{
             "key": "service.name",
             "value": {"stringValue": "test-service"}
           }]
         },
         "scopeSpans": [{
           "spans": [{
             "traceId": "12345678901234567890123456789012",
             "spanId": "1234567890123456",
             "name": "test-span",
             "kind": 1,
             "startTimeUnixNano": "'$(date +%s)000000000'",
             "endTimeUnixNano": "'$(date +%s)000000000'"
           }]
         }]
       }]
     }'
   ```

5. **Check for rate limiting:**
   ```bash
   docker compose logs openobserve | grep -i "rate\|limit\|throttle"
   ```

---

### Issue 8: "Apps can't connect to collector"

**Symptoms:**
- App logs show "connection refused"
- Error: "Failed to export traces"

**Solutions:**

1. **Verify collector is running:**
   ```bash
   docker compose ps otel-collector
   ```

2. **Check collector is accessible from app:**
   ```bash
   # From Node.js app
   docker compose exec nodejs-app nc -zv otel-collector 4318
   
   # From Python app
   docker compose exec python-app nc -zv otel-collector 4318
   ```

3. **Verify network configuration:**
   ```bash
   # Check network
   docker network inspect observability_observability-network
   
   # All services should be on the same network
   ```

4. **Check DNS resolution:**
   ```bash
   docker compose exec nodejs-app nslookup otel-collector
   ```

5. **Verify endpoint in app environment:**
   ```bash
   docker compose exec nodejs-app env | grep OTEL
   # Should show: OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
   ```

6. **Restart services:**
   ```bash
   docker compose restart otel-collector nodejs-app python-app
   ```

---

### Issue 9: "Missing or incomplete traces"

**Symptoms:**
- Some traces appear, others don't
- Broken trace hierarchies
- Missing spans

**Solutions:**

1. **Check sampling configuration:**
   
   In app tracing code, ensure sampling is not filtering traces:
   
   ```javascript
   // Node.js - tracing.js
   // Add this for local dev (sample all):
   const { AlwaysOnSampler } = require('@opentelemetry/sdk-trace-base');
   
   const sdk = new NodeSDK({
     sampler: new AlwaysOnSampler(),  // Add this
     // ... rest of config
   });
   ```

2. **Check batch processor limits:**
   
   ```javascript
   // If using custom batch processor
   const processor = new BatchSpanProcessor(exporter, {
     maxQueueSize: 2048,        // Increase
     maxExportBatchSize: 512,   // Increase
     scheduledDelayMillis: 500, // Reduce delay
   });
   ```

3. **Verify context propagation:**
   
   ```bash
   # Check if trace context headers are present
   docker compose logs nodejs-app | grep -i "traceparent"
   ```

4. **Check for dropped spans:**
   
   ```bash
   docker compose logs otel-collector | grep -i "dropped\|refused"
   ```

5. **Increase collector queue size** (in otel-collector-config.yaml):
   
   ```yaml
   exporters:
     otlphttp/traces:
       sending_queue:
         enabled: true
         num_consumers: 10
         queue_size: 1000
   ```

---

### Issue 10: "OpenObserve UI is slow"

**Symptoms:**
- Long query times
- UI unresponsive
- Timeouts

**Solutions:**

1. **Limit time range in queries:**
   
   Instead of querying all data:
   ```sql
   -- Good: Limited time range
   SELECT * FROM default 
   WHERE _timestamp > now() - interval '1 hour'
   LIMIT 100
   
   -- Bad: Full table scan
   SELECT * FROM default
   ```

2. **Add filters early:**
   
   ```sql
   -- Good: Filter first
   SELECT * FROM default 
   WHERE service_name = 'nodejs-sample-app'
     AND level = 'ERROR'
   ORDER BY _timestamp DESC
   LIMIT 100
   
   -- Bad: Filter after sorting
   SELECT * FROM default 
   ORDER BY _timestamp DESC
   ```

3. **Limit result size:**
   
   Always use LIMIT in queries:
   ```sql
   SELECT * FROM default 
   WHERE _timestamp > now() - interval '1 hour'
   LIMIT 100  -- Add this
   ```

4. **Use appropriate aggregations:**
   
   ```sql
   -- Good: Pre-aggregated
   SELECT 
     service_name,
     COUNT(*) as count,
     DATE_TRUNC('minute', _timestamp) as minute
   FROM default 
   WHERE _timestamp > now() - interval '1 hour'
   GROUP BY service_name, minute
   
   -- Bad: Large result set
   SELECT * FROM default 
   WHERE _timestamp > now() - interval '1 hour'
   ```

5. **Increase OpenObserve resources:**
   
   ```yaml
   # docker-compose.yml
   openobserve:
     mem_limit: 2g  # Increase from 1g
     cpus: 2.0      # Increase from 1.0
   ```

---

## Debugging Checklist

Use this checklist to systematically debug issues:

### Step 1: Verify Services

- [ ] All containers running: `docker compose ps`
- [ ] OpenObserve healthy: `curl http://localhost:5080/healthz`
- [ ] Collector healthy: `curl http://localhost:13133`
- [ ] Node.js app responding: `curl http://localhost:3000/health`
- [ ] Python app responding: `curl http://localhost:8000/health`

### Step 2: Check Connectivity

- [ ] Apps can reach collector: `docker compose exec nodejs-app nc -zv otel-collector 4318`
- [ ] Collector can reach OpenObserve: `docker compose exec otel-collector wget -O- http://openobserve:5080/healthz`
- [ ] All on same network: `docker network inspect observability_observability-network`

### Step 3: Check Configuration

- [ ] Environment variables set: `docker compose exec otel-collector env | grep OPENOBSERVE`
- [ ] Collector config valid: `docker compose exec otel-collector cat /etc/otel-collector-config.yaml`
- [ ] No syntax errors in YAML files

### Step 4: Check Logs

- [ ] No errors in OpenObserve: `docker compose logs openobserve | grep -i error`
- [ ] No errors in collector: `docker compose logs otel-collector | grep -i error`
- [ ] Apps initialized OTel: `docker compose logs nodejs-app | grep -i opentelemetry`

### Step 5: Verify Data Flow

- [ ] Apps sending data: Check app logs for export messages
- [ ] Collector receiving: `docker compose logs otel-collector | grep -i "received"`
- [ ] Collector exporting: `docker compose logs otel-collector | grep -i "exported"`
- [ ] Data in OpenObserve: Check UI

---

## Log Analysis

### Understanding Collector Logs

**Healthy collector logs:**
```
2024-01-15T10:00:00.000Z info TracesExporter {"kind": "exporter", "name": "otlphttp/traces", "traces": 42}
2024-01-15T10:00:00.000Z info MetricsExporter {"kind": "exporter", "name": "otlphttp/metrics", "metrics": 156}
```

**Problem indicators:**
```
ERROR: failed to export traces: 401 Unauthorized
ERROR: failed to push data: connection refused
WARN: dropping span due to queue full
ERROR: context deadline exceeded
```

### Understanding App Logs

**Healthy Node.js app:**
```
OpenTelemetry SDK started successfully
Server started {"port":3000}
Incoming request {"method":"GET","path":"/"}
```

**Problem indicators:**
```
Error: getaddrinfo ENOTFOUND otel-collector
Error: connect ECONNREFUSED
Failed to export traces
```

---

## Performance Issues

### Symptoms

- High CPU usage
- High memory usage
- Slow response times
- Frequent restarts

### Solutions

1. **Monitor resource usage:**
   ```bash
   docker stats
   ```

2. **Reduce batch size** (reduces memory, increases network calls)
3. **Increase batch timeout** (reduces network calls, increases latency)
4. **Enable sampling** (reduces data volume)
5. **Add resource limits** (prevents resource exhaustion)
6. **Disable debug logging** (reduces I/O)

---

## Getting Help

### Before Asking for Help

Gather this information:

1. **System info:**
   ```bash
   docker --version
   docker compose version
   uname -a
   ```

2. **Service status:**
   ```bash
   docker compose ps
   ```

3. **Recent logs:**
   ```bash
   docker compose logs --tail=100 > logs.txt
   ```

4. **Configuration:**
   - docker-compose.yml
   - otel-collector-config.yaml

### Useful Commands

```bash
# Export all logs
docker compose logs > all-logs.txt

# Check resource usage
docker stats --no-stream > stats.txt

# Inspect networks
docker network ls
docker network inspect observability_observability-network

# Check volumes
docker volume ls
docker volume inspect observability_openobserve_data

# Full diagnostic
docker compose ps > diagnostic.txt
docker compose logs >> diagnostic.txt
docker stats --no-stream >> diagnostic.txt
```

---

## Advanced Debugging

### Enable Verbose Logging

**Collector:**
```yaml
# otel-collector-config.yaml
service:
  telemetry:
    logs:
      level: debug
```

**Node.js:**
```javascript
// tracing.js
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
```

**Python:**
```python
# tracing.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Network Debugging

```bash
# Capture network traffic
docker compose exec otel-collector tcpdump -i any -w /tmp/capture.pcap

# Trace network calls
docker compose exec nodejs-app strace -e trace=network -p 1
```

### Performance Profiling

```bash
# CPU profiling (collector)
curl http://localhost:1777/debug/pprof/profile?seconds=30 > cpu.prof

# Memory profiling (collector)
curl http://localhost:1777/debug/pprof/heap > heap.prof
```

---

**Last Updated:** 2024-01-15
