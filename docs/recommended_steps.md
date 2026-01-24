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

Create a time-series table:

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE telemetry (
  asset_id TEXT,
  ts TIMESTAMPTZ,
  temperature DOUBLE PRECISION,
  speed DOUBLE PRECISION
);
SELECT create_hypertable('telemetry', 'ts');
```

## ClickHouse Basic Table

```sql
CREATE TABLE telemetry (
  asset_id String,
  ts DateTime,
  temperature Float32,
  speed Float32
) ENGINE = MergeTree()
ORDER BY (asset_id, ts);
```

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