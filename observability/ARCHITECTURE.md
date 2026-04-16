# Architecture Diagram - OpenObserve Observability Stack

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SAMPLE APPLICATIONS LAYER                           │
│                                                                          │
│  ┌─────────────────────────┐        ┌─────────────────────────┐        │
│  │   Node.js Application   │        │   Python Application    │        │
│  │                         │        │                         │        │
│  │  • Express.js           │        │  • FastAPI              │        │
│  │  • Port: 3000           │        │  • Port: 8000           │        │
│  │  • OTel SDK (Auto)      │        │  • OTel SDK (Auto)      │        │
│  │                         │        │                         │        │
│  │  Instrumentation:       │        │  Instrumentation:       │        │
│  │  - HTTP requests        │        │  - HTTP requests        │        │
│  │  - Custom metrics       │        │  - Custom metrics       │        │
│  │  - Structured logs      │        │  - Structured logs      │        │
│  │  - Distributed traces   │        │  - Distributed traces   │        │
│  └──────────┬──────────────┘        └──────────┬──────────────┘        │
└─────────────┼─────────────────────────────────┼────────────────────────┘
              │                                  │
              │                                  │
              │     OTLP/HTTP (Port 4318)        │
              │     - Traces                     │
              │     - Metrics                    │
              │     - Logs                       │
              │                                  │
              └────────────────┬─────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     TELEMETRY PIPELINE LAYER                            │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │         OpenTelemetry Collector (Contrib Distribution)          │  │
│  │                                                                   │  │
│  │  ┌────────────┐   ┌──────────────┐   ┌────────────────────┐    │  │
│  │  │ Receivers  │──▶│  Processors  │──▶│    Exporters       │    │  │
│  │  └────────────┘   └──────────────┘   └────────────────────┘    │  │
│  │                                                                   │  │
│  │  Receivers:           Processors:         Exporters:             │  │
│  │  • OTLP gRPC (4317)   • Batch             • OpenObserve (OTLP)  │  │
│  │  • OTLP HTTP (4318)   • Memory Limiter    • Debug               │  │
│  │  • Prometheus (8888)  • Resource          • Prometheus (8889)   │  │
│  │                       • Attributes                               │  │
│  │                                                                   │  │
│  │  Extensions:          Telemetry:                                 │  │
│  │  • Health (13133)     • Metrics (8888)                           │  │
│  │  • pprof (1777)       • Logs (stdout)                            │  │
│  │  • zpages (55679)                                                │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────────┼──────────────────────────────────────┘
                                  │
                                  │
                                  │ OTLP/HTTP
                                  │ - /api/default/traces
                                  │ - /api/default/metrics
                                  │ - /api/default/logs
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     OBSERVABILITY PLATFORM LAYER                        │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        OpenObserve                               │  │
│  │                        Port: 5080                                │  │
│  │                                                                   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │  Ingestion   │  │   Storage    │  │   Query Engine       │  │  │
│  │  │   Engine     │  │              │  │                      │  │  │
│  │  │              │  │  • Indexed   │  │  • SQL-based         │  │  │
│  │  │ • OTLP API   │─▶│  • Columnar  │◀─│  • Full-text search  │  │  │
│  │  │ • REST API   │  │  • Compressed│  │  • Aggregations      │  │  │
│  │  │ • Syslog     │  │              │  │  • Joins             │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  │                                                                   │  │
│  │  ┌──────────────────────────────────────────────────────────┐   │  │
│  │  │                    Web UI                                │   │  │
│  │  │                                                           │   │  │
│  │  │  • Logs Browser        • Dashboards                     │   │  │
│  │  │  • Trace Viewer        • Alerts                         │   │  │
│  │  │  • Metrics Explorer    • User Management                │   │  │
│  │  └──────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTP/S
                                  │ Browser Access
                                  ▼
                          ┌────────────────┐
                          │   End User     │
                          │   (Browser)    │
                          └────────────────┘
```

## Data Flow Diagram

```
┌──────────────┐
│ Application  │
│  Generates:  │
│  • Trace     │──┐
│  • Metric    │  │
│  • Log       │  │
└──────────────┘  │
                  │ (1) Auto-instrumentation
                  │     captures telemetry
                  ▼
┌──────────────────────────────────┐
│    OpenTelemetry SDK             │
│    (in application process)      │
│                                  │
│  • Context propagation           │
│  • Trace creation                │
│  • Metric collection             │
│  • Log enrichment                │
│  • Resource attributes           │
│  • Sampling decisions            │
└─────────────┬────────────────────┘
              │
              │ (2) Batched OTLP export
              │     (HTTP or gRPC)
              ▼
┌──────────────────────────────────┐
│  OpenTelemetry Collector         │
│                                  │
│  Receivers:                      │
│  └─ Receive OTLP data            │
│                                  │
│  Processors:                     │
│  ├─ Memory Limiter ─────────────┼─── (3) Protect from OOM
│  ├─ Batch ──────────────────────┼─── (4) Buffer & batch data
│  ├─ Resource ────────────────────┼─── (5) Add metadata
│  └─ Attributes ──────────────────┼─── (6) Enrich attributes
│                                  │
│  Exporters:                      │
│  ├─ OTLP/HTTP → OpenObserve ────┼─── (7) Send to O2
│  ├─ Debug → Stdout ──────────────┼─── (8) Console logging
│  └─ Prometheus → :8889 ──────────┼─── (9) Expose metrics
└─────────────┬────────────────────┘
              │
              │ (7) OTLP/HTTP POST
              │     with Basic Auth
              │     Gzip compressed
              ▼
┌──────────────────────────────────┐
│       OpenObserve                │
│                                  │
│  API Endpoints:                  │
│  ├─ /api/default/traces ─────────┼─── (10) Trace ingestion
│  ├─ /api/default/metrics ────────┼─── (11) Metric ingestion
│  └─ /api/default/logs ───────────┼─── (12) Log ingestion
│                                  │
│  Processing:                     │
│  ├─ Parse & validate ────────────┼─── (13) Validate format
│  ├─ Index fields ────────────────┼─── (14) Create indices
│  ├─ Compress & store ────────────┼─── (15) Persist to disk
│  └─ Update metadata ─────────────┼─── (16) Update catalogs
│                                  │
│  Query:                          │
│  └─ SQL query engine ────────────┼─── (17) Query data via UI
└─────────────┬────────────────────┘
              │
              │ (18) HTTP/JSON response
              │      to Web UI queries
              ▼
         ┌──────────┐
         │ Web UI   │
         │ (Browser)│
         └──────────┘
```

## Network Topology

```
Docker Network: observability-network (Bridge)
─────────────────────────────────────────────────

Container: openobserve
├─ Hostname: openobserve
├─ Internal IP: 172.x.x.2 (example)
├─ Exposed Ports: 0.0.0.0:5080 → 5080
└─ Connected to: observability-network

Container: otel-collector
├─ Hostname: otel-collector
├─ Internal IP: 172.x.x.3 (example)
├─ Exposed Ports:
│  ├─ 0.0.0.0:4317 → 4317 (OTLP gRPC)
│  ├─ 0.0.0.0:4318 → 4318 (OTLP HTTP)
│  ├─ 0.0.0.0:8888 → 8888 (Metrics)
│  ├─ 0.0.0.0:8889 → 8889 (Prometheus)
│  └─ 0.0.0.0:13133 → 13133 (Health)
└─ Connected to: observability-network
   Connects to: openobserve:5080

Container: nodejs-app
├─ Hostname: nodejs-app
├─ Internal IP: 172.x.x.4 (example)
├─ Exposed Ports: 0.0.0.0:3000 → 3000
└─ Connected to: observability-network
   Connects to: otel-collector:4318

Container: python-app
├─ Hostname: python-app
├─ Internal IP: 172.x.x.5 (example)
├─ Exposed Ports: 0.0.0.0:8000 → 8000
└─ Connected to: observability-network
   Connects to: otel-collector:4318

Container: traffic-generator
├─ Hostname: traffic-generator
├─ Internal IP: 172.x.x.6 (example)
├─ Exposed Ports: None
└─ Connected to: observability-network
   Connects to:
   ├─ nodejs-app:3000
   └─ python-app:8000
```

## Component Details

### OpenObserve

**Purpose**: Central observability platform for storing and querying telemetry data

**Key Features**:
- OTLP native ingestion
- SQL-based query engine
- Unified storage for logs, metrics, traces
- Real-time indexing
- Columnar storage with compression
- Web UI for visualization

**Endpoints**:
- Web UI: `http://localhost:5080`
- API: `http://localhost:5080/api/`
- Traces: `http://localhost:5080/api/default/traces`
- Metrics: `http://localhost:5080/api/default/metrics`
- Logs: `http://localhost:5080/api/default/logs`

### OpenTelemetry Collector

**Purpose**: Telemetry data pipeline - receives, processes, and exports observability data

**Receivers**:
- `otlp/grpc` (port 4317): Receives OTLP over gRPC
- `otlp/http` (port 4318): Receives OTLP over HTTP
- `prometheus` (port 8888): Scrapes own metrics

**Processors**:
- `memory_limiter`: Prevents OOM by limiting memory usage
- `batch`: Buffers and batches data for efficiency
- `resource`: Adds resource attributes
- `attributes`: Manipulates span/metric attributes

**Exporters**:
- `otlphttp/traces`: Sends traces to OpenObserve
- `otlphttp/metrics`: Sends metrics to OpenObserve
- `otlphttp/logs`: Sends logs to OpenObserve
- `debug`: Logs to console (troubleshooting)
- `prometheus`: Exposes metrics on port 8889

**Extensions**:
- `health_check` (port 13133): Health endpoint
- `pprof` (port 1777): Performance profiling
- `zpages` (port 55679): Diagnostics pages

### Node.js Sample Application

**Framework**: Express.js

**Instrumentation**:
- Auto-instrumentation via `@opentelemetry/auto-instrumentations-node`
- Automatic HTTP request/response tracing
- Automatic span creation
- Manual custom spans and metrics

**Key Components**:
- `tracing.js`: OpenTelemetry SDK initialization
- `index.js`: Application logic with custom instrumentation
- `package.json`: Dependencies

**Telemetry Generated**:
- **Traces**: HTTP requests, custom operations
- **Metrics**: Request count, duration, active requests
- **Logs**: Structured logs with Pino

### Python Sample Application

**Framework**: FastAPI

**Instrumentation**:
- Auto-instrumentation via `opentelemetry-instrumentation-fastapi`
- Automatic HTTP request/response tracing
- Automatic async operation tracking
- Manual custom spans and events

**Key Components**:
- `tracing.py`: OpenTelemetry SDK initialization
- `main.py`: FastAPI application with custom instrumentation
- `requirements.txt`: Dependencies

**Telemetry Generated**:
- **Traces**: HTTP requests, async operations
- **Metrics**: Request count, duration, active requests
- **Logs**: Python logging with OpenTelemetry integration

## Data Types & Formats

### Traces

**Format**: OTLP (OpenTelemetry Protocol)

**Structure**:
```
Trace
└── Spans
    ├── Span ID
    ├── Trace ID
    ├── Parent Span ID
    ├── Name
    ├── Kind (SERVER, CLIENT, INTERNAL, etc.)
    ├── Start Time
    ├── End Time
    ├── Status (OK, ERROR)
    ├── Attributes (key-value pairs)
    ├── Events (timestamped messages)
    └── Links (to other spans)
```

### Metrics

**Format**: OTLP (OpenTelemetry Protocol)

**Types**:
- **Counter**: Monotonically increasing value (e.g., request count)
- **Gauge**: Current value (e.g., active requests)
- **Histogram**: Distribution of values (e.g., request duration)

**Structure**:
```
Metric
├── Name
├── Description
├── Unit
├── Type (Counter, Gauge, Histogram)
├── Data Points
│   ├── Timestamp
│   ├── Value
│   └── Attributes (labels)
└── Resource Attributes
```

### Logs

**Format**: OTLP (OpenTelemetry Protocol)

**Structure**:
```
LogRecord
├── Timestamp
├── Severity (INFO, WARN, ERROR, etc.)
├── Body (message)
├── Attributes (structured data)
├── Resource Attributes
├── Trace Context (if in span)
│   ├── Trace ID
│   └── Span ID
└── Instrumentation Scope
```

## Security Architecture

```
┌────────────────────┐
│   External User    │
│    (Browser)       │
└─────────┬──────────┘
          │
          │ HTTP
          ▼
┌─────────────────────────────┐
│   OpenObserve Web UI        │
│   Port: 5080                │
│                             │
│   Authentication:           │
│   • Email/Password          │
│   • Session cookies         │
│   • JWT tokens (future)     │
└─────────────────────────────┘

┌────────────────────┐
│  Applications      │
│  (nodejs, python)  │
└─────────┬──────────┘
          │
          │ OTLP/HTTP (no auth)
          │ Internal network only
          ▼
┌─────────────────────────────┐
│  OpenTelemetry Collector    │
│  Ports: 4317, 4318          │
│                             │
│  Authentication: None       │
│  (Internal network)         │
└──────────┬──────────────────┘
           │
           │ OTLP/HTTP
           │ Basic Auth:
           │ Authorization: Basic <base64>
           ▼
┌─────────────────────────────┐
│      OpenObserve API        │
│      Port: 5080             │
│                             │
│  Authentication:            │
│  • Basic Auth               │
│  • Validates credentials    │
│  • Returns 401 if invalid   │
└─────────────────────────────┘
```

**Security Notes**:
- ⚠️  Default credentials are for **local development only**
- ⚠️  Change credentials in production
- ⚠️  Use TLS/HTTPS in production
- ⚠️  Restrict network access appropriately
- ✅  Collector validates data before forwarding
- ✅  OpenObserve validates credentials on ingestion

## Scaling Considerations

### Vertical Scaling (Single Instance)

```
┌────────────────────────────────┐
│  Increase Resources            │
│                                │
│  OpenObserve:                  │
│  ├─ CPU: 1 → 4 cores          │
│  ├─ RAM: 1GB → 4GB            │
│  └─ Disk: SSD recommended      │
│                                │
│  Collector:                    │
│  ├─ CPU: 0.5 → 2 cores        │
│  ├─ RAM: 512MB → 2GB          │
│  └─ Increase batch sizes       │
└────────────────────────────────┘
```

### Horizontal Scaling (Multiple Instances)

```
┌──────────────┐     ┌──────────────┐
│ Collector 1  │     │ Collector 2  │
└──────┬───────┘     └──────┬───────┘
       │                    │
       │    ┌───────────────┘
       │    │
       ▼    ▼
    ┌──────────────┐
    │ Load Balancer│
    │  (nginx)     │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ OpenObserve  │
    │   Cluster    │
    └──────────────┘
```

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-15
