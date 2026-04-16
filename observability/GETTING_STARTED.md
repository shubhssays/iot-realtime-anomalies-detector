# Getting Started - OpenObserve Observability Stack

This guide will help you get started with the OpenObserve observability stack in **5 minutes**.

## Prerequisites

Before you begin, ensure you have:

- ✅ Docker 20.10+ installed
- ✅ Docker Compose v2+ installed
- ✅ 4GB+ RAM available
- ✅ Linux or macOS (Windows users: use WSL2)

Verify your installation:

```bash
docker --version
docker compose version
```

## Installation Methods

Choose one of the following methods:

### Method 1: Automated Setup (Recommended)

```bash
# Navigate to observability directory
cd observability

# Run setup script
./setup.sh

# Wait ~30 seconds for services to start
```

### Method 2: Manual Setup

```bash
# Navigate to observability directory
cd observability

# Start all services
docker compose up -d

# Check service status
docker compose ps

# View logs
docker compose logs -f
```

## Verify Installation

After starting the stack, verify all services are running:

```bash
# Check container status
docker compose ps

# All services should show "Up" or "Up (healthy)"
```

Expected output:
```
NAME                IMAGE                                    STATUS
nodejs-app          observability-nodejs-app                 Up
openobserve         public.ecr.aws/zinclabs/openobserve      Up (healthy)
otel-collector      otel/opentelemetry-collector-contrib     Up
python-app          observability-python-app                 Up
traffic-generator   curlimages/curl                          Up
```

## Access the Services

### 1. OpenObserve Web UI

Open your browser and navigate to: **http://localhost:5080**

**Login Credentials:**
- Email: `admin@example.com`
- Password: `Admin@123`

### 2. Sample Applications

**Node.js App**: http://localhost:3000
```bash
# Test the endpoints
curl http://localhost:3000/
curl http://localhost:3000/api/users
curl http://localhost:3000/health
```

**Python App**: http://localhost:8000
```bash
# Test the endpoints
curl http://localhost:8000/
curl http://localhost:8000/items/1
curl http://localhost:8000/health
```

## View Your First Traces

1. Open OpenObserve UI: http://localhost:5080
2. Login with credentials above
3. Click **"Traces"** in the left sidebar
4. Select organization: **"default"**
5. Select stream: **"default"**
6. You should see traces from the sample applications!

**What to look for:**
- Traces from `nodejs-sample-app`
- Traces from `python-sample-app`
- Different operations (GET /, /api/users, /items/{id})
- Slow operations (>1s duration)
- Error traces (500 status codes)

## View Your First Logs

1. In OpenObserve UI, click **"Logs"** in the left sidebar
2. Select organization: **"default"**
3. Select stream: **"default"**
4. You should see logs from both applications!

**Try this query:**
```sql
SELECT * FROM default 
WHERE service_name = 'nodejs-sample-app'
  AND _timestamp > now() - interval '10 minutes'
ORDER BY _timestamp DESC 
LIMIT 100
```

## View Your First Metrics

1. In OpenObserve UI, click **"Metrics"** in the left sidebar
2. Select organization: **"default"**
3. Select stream: **"default"**
4. You should see metrics from the applications!

**Available metrics:**
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration
- `http_requests_active` - Active requests

## Generate Custom Traffic

The stack includes an automatic traffic generator, but you can also generate traffic manually:

```bash
# Use the provided script
./generate-traffic.sh

# Or manually test endpoints
curl http://localhost:3000/api/users
curl http://localhost:3000/api/products
curl http://localhost:3000/api/slow    # Slow endpoint (2-3s)
curl http://localhost:3000/api/error   # Error endpoint

curl http://localhost:8000/items/1
curl http://localhost:8000/slow        # Slow endpoint (2-3s)
curl http://localhost:8000/error       # Error endpoint
```

## Understanding the Stack

### What's Running?

| Service | Purpose | Port |
|---------|---------|------|
| **OpenObserve** | Observability platform | 5080 |
| **OTel Collector** | Telemetry pipeline | 4318, 4317 |
| **Node.js App** | Sample application | 3000 |
| **Python App** | Sample application | 8000 |
| **Traffic Generator** | Automatic testing | - |

### Data Flow

```
Applications
    ↓ (OpenTelemetry SDK)
    ↓ OTLP/HTTP
    ↓
OpenTelemetry Collector
    ↓ (Processing & Batching)
    ↓ OTLP/HTTP
    ↓
OpenObserve
    ↓ (Storage & Indexing)
    ↓
Web UI (You!)
```

## Next Steps

Now that you have the stack running, try these:

### 1. Explore Traces

**Find slow requests:**
1. Go to Traces
2. Filter by duration: `> 1000ms`
3. Click on a slow trace to see details

**Find errors:**
1. Go to Traces
2. Filter by status: `ERROR`
3. Click on an error trace to see exception details

### 2. Create Your First Dashboard

1. Click **"Dashboards"** in the sidebar
2. Click **"Create Dashboard"**
3. Add panels:
   - **Request Rate**: Show requests per second
   - **Error Rate**: Show errors over time
   - **Latency**: Show P95 latency

### 3. Query Logs

Try these SQL queries in the Logs section:

**Find all errors:**
```sql
SELECT * FROM default 
WHERE level = 'ERROR'
  AND _timestamp > now() - interval '1 hour'
ORDER BY _timestamp DESC
```

**Count logs by service:**
```sql
SELECT service_name, COUNT(*) as count
FROM default 
WHERE _timestamp > now() - interval '1 hour'
GROUP BY service_name
```

**Search for specific text:**
```sql
SELECT * FROM default 
WHERE body LIKE '%user%'
  AND _timestamp > now() - interval '1 hour'
LIMIT 100
```

### 4. Instrument Your Own App

Want to add observability to your own application? Check out:

- [Node.js Example](apps/nodejs-sample/README.md)
- [Python Example](apps/python-sample/README.md)
- [OpenTelemetry Docs](https://opentelemetry.io/docs/)

### 5. Learn More

- Read the [Complete Guide](README.md)
- Understand the [Architecture](ARCHITECTURE.md)
- Review [Troubleshooting Tips](TROUBLESHOOTING.md)
- Check the [Quick Reference](QUICK_REFERENCE.md)

## Common Issues

### "Cannot access http://localhost:5080"

**Solution:**
```bash
# Check if OpenObserve is running
docker compose ps openobserve

# View logs
docker compose logs openobserve

# Restart if needed
docker compose restart openobserve
```

### "No data appearing in OpenObserve"

**Solution:**
```bash
# Check if apps are sending data
docker compose logs otel-collector | grep -i "traces"

# Verify collector health
curl http://localhost:13133

# Check for errors
docker compose logs otel-collector | grep -i "error"
```

### "Services won't start"

**Solution:**
```bash
# Check for port conflicts
sudo lsof -i :5080
sudo lsof -i :4318

# View detailed logs
docker compose logs

# Try a clean restart
docker compose down
docker compose up -d
```

## Getting Help

If you encounter issues:

1. Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
2. View logs: `docker compose logs`
3. Check service health: `docker compose ps`
4. Review configuration files

## Stopping the Stack

When you're done:

```bash
# Stop all services
docker compose down

# Stop and remove all data
docker compose down -v

# Stop and remove images too
docker compose down -v --rmi all
```

## What's Next?

You now have a complete observability stack running locally! Here's what you can do:

1. ✅ **Explore the sample apps** - See how OpenTelemetry instrumentation works
2. ✅ **Customize the stack** - Modify docker-compose.yml to fit your needs
3. ✅ **Add your own services** - Instrument your applications
4. ✅ **Create dashboards** - Build custom visualizations
5. ✅ **Set up alerts** - Get notified of issues
6. ✅ **Learn OpenTelemetry** - Master modern observability

## Resources

- [OpenObserve Documentation](https://openobserve.ai/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Sample App Source Code](apps/)

---

**Congratulations! You now have a production-grade observability stack running locally! 🎉**

For detailed information, see the [Complete README](README.md).
