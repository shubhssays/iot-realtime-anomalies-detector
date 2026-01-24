# 📌 Next Steps (Recommended)

## Create Kafka Topics

```bash
docker exec kafka kafka-topics --bootstrap-server localhost:9092 \
  --create --topic iot.telemetry --partitions 3 --replication-factor 1

docker exec kafka kafka-topics --bootstrap-server localhost:9092 \
  --create --topic iot.anomalies --partitions 3 --replication-factor 1
```


## TimescaleDB Setup

Connect with `psql`:

```bash
psql -h localhost -p 5432 -U postgres -d telemetry
```


Create time-series tables:

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE telemetry (
  asset_id TEXT,
  ts TIMESTAMPTZ,
  temperature DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  PRIMARY KEY (asset_id, ts)
);
SELECT create_hypertable('telemetry', 'ts');

CREATE TABLE anomalies (
  id BIGSERIAL PRIMARY KEY,
  asset_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  current_temperature DOUBLE PRECISION,
  baseline_temperature DOUBLE PRECISION,
  distance_from_route_km DOUBLE PRECISION,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
SELECT create_hypertable('anomalies', 'ts');
CREATE INDEX idx_anomaly_asset_time ON anomalies (asset_id, ts DESC);
CREATE INDEX idx_anomaly_severity ON anomalies (severity, ts DESC);
CREATE INDEX idx_anomaly_open ON anomalies (acknowledged, ts DESC);
```

### Why anomalies go into TimescaleDB

Timescale (Postgres) is your system of record.

You use it for:

- Alerting
- Incident tracking
- SLA violations
- Acknowledgements
- Workflow state

Example:

- Has this anomaly been acknowledged?
- Who is handling it?
- Is this still open?




## ClickHouse Tables

```sql
CREATE TABLE telemetry (
  asset_id String,
  ts DateTime,
  temperature Float32,
  speed Float32
) ENGINE = MergeTree()
ORDER BY (asset_id, ts);

CREATE TABLE anomalies
(
    asset_id String,
    type LowCardinality(String),
    severity LowCardinality(String),
    ts DateTime64(3),
    current_temperature Float32,
    baseline_temperature Float32,
    distance_from_route_km Float32,
    lat Float64,
    lon Float64,
    version UInt64
)
ENGINE = ReplacingMergeTree(version)
PARTITION BY toYYYYMM(ts)
ORDER BY (asset_id, ts);
```
## Startup

To start all services and listeners:

```bash
yarn docker_up
yarn first_time_init
# Start telemetry and anomaly listeners:
node apps/node-backend/listener/telemetry-listener.js
node apps/node-backend/listener/anomaly-listener.js
```

### Why anomalies go into ClickHouse

ClickHouse is for:

- Trends
- Aggregations
- Charts
- Root cause
- Customer reports

Example:

- Show me temperature anomalies per warehouse last 30 days
- Show deviation heatmap
- Show worst routes

These are:

- Billions of rows
- Group by
- Time windows
- Filters

Timescale would be slow and expensive here.

## 🧠 Expert Tips

- ✔ Kafka partitions should be equal to your Flink parallelism.
- ✔ Use compression (lz4/snappy) for performance.
- ✔ Flink's checkpointing makes your jobs resilient.
- ✔ TimescaleDB is best for time-series retention + rollups.
- ✔ ClickHouse for fast analytical queries on telemetry.

## 🧯 Troubleshooting

### If Flink can't reach Kafka:

Ensure Kafka listener advertises the correct address

From Flink container:

```bash
kafka-topics --bootstrap-server kafka:9092 --list
```

### If Timescale isn't ready:

Increase healthcheck retries