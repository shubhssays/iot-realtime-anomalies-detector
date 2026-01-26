# IoT Real-time Anomaly Detection System

A real-time IoT anomaly detection pipeline using Apache Kafka, Apache Flink, TimescaleDB, ClickHouse, and a WebSocket-powered dashboard.

> **Note:** This project uses [Redpanda](https://redpanda.com/) as the message broker, which is a Kafka-compatible streaming platform. Throughout the documentation, we refer to it as "Kafka" since they are API-compatible.

## Screenshots

### Real-time Alerts Dashboard
![Real-time Alerts Using WebSockets](screenshots/4.%20Realtime%20Alerts%20Using%20Websockets.png)

### Apache Flink Dashboard
| Dashboard Overview | Running Jobs |
|:------------------:|:------------:|
| ![Flink Dashboard](screenshots/1.%20Apache%20Flink%20Dashboard.png) | ![Running Jobs](screenshots/2.%20Apache%20Flink%20Running%20Jobs.png) |

| Task Managers |
|:-------------:|
| ![Task Managers](screenshots/3.%20Apache%20Flink%20Task%20Managers.png) |

## Architecture

```
                                    ┌───────────────────┐
                                    │   IoT Simulator   │
                                    └─────────┬─────────┘
                                              │
                                              ▼
                                    ┌───────────────────┐
                                    │      Kafka        │
                                    │  ┌─────────────┐  │
                                    │  │iot.telemetry│  │
                                    │  │iot.anomalies│  │
                                    │  └─────────────┘  │
                                    └────────┬──────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
         ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
         │ Telemetry Listener│    │   Apache Flink    │    │ Anomaly Listener  │
         │   (Node.js)       │    │ (Stream Process)  │    │   (Node.js)       │
         └─────────┬─────────┘    └─────────┬─────────┘    └─────────┬─────────┘
                   │                        │                        │
                   │              Detects anomalies &                │
                   │              writes to iot.anomalies            │
                   │                                                 │
                   ▼                                                 ▼
    ┌──────────────────────────────┐              ┌──────────────────────────────┐
    │     Writes telemetry to:     │              │     Writes anomalies to:     │
    │  • TimescaleDB (telemetry)   │              │  • TimescaleDB (anomalies)   │
    │  • ClickHouse  (telemetry)   │              │  • ClickHouse  (anomalies)   │
    └──────────────────────────────┘              │  • WebSocket   (real-time)   │
                                                  └───────────────┬──────────────┘
                                                                  │
                                                                  ▼
                                                       ┌───────────────────┐
                                                       │ Frontend Dashboard│
                                                       │  (Real-time UI)   │
                                                       └───────────────────┘
```

### Data Flow Summary

| Topic | Consumer | Destination Tables |
|-------|----------|-------------------|
| `iot.telemetry` | Telemetry Listener | TimescaleDB `telemetry`, ClickHouse `telemetry` |
| `iot.anomalies` | Anomaly Listener | TimescaleDB `anomalies`, ClickHouse `anomalies` |
| `iot.anomalies` | Anomaly Listener | WebSocket → Frontend (real-time alerts) |

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Message Broker | Apache Kafka | Event streaming |
| Stream Processing | Apache Flink | Real-time anomaly detection |
| Time-series DB | TimescaleDB | Alerting & incident tracking |
| Analytics DB | ClickHouse | Fast analytical queries |
| Backend | Node.js | Kafka consumers & WebSocket server |
| Frontend | HTML/CSS/JS | Real-time dashboard |

## Prerequisites

| Requirement | Version | Download |
|-------------|---------|----------|
| **Java (JDK)** | 11 or 17 | [Oracle JDK](https://www.oracle.com/java/technologies/downloads/) or [OpenJDK](https://adoptium.net/) |
| **Apache Maven** | 3.8+ | [Download Maven](https://maven.apache.org/download.cgi) |
| **Docker** | Latest | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| **Docker Compose** | v2+ | Included with Docker Desktop |
| **Node.js** | v18+ | [Download Node.js](https://nodejs.org/) |
| **Yarn** | Latest | Install via `npm install -g yarn` |

> **Tip:** After installing Java and Maven, verify your setup by running:
> ```bash
> java -version
> mvn -version
> docker --version
> node --version
> ```

## Project Structure

```
iot-realtime-anomalies-detector/
├── apps/
│   ├── frontend/              # Real-time anomaly dashboard
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── app.js
│   ├── flink-job/             # Apache Flink anomaly detection job
│   └── node-backend/
│       ├── db/                # Database clients (ClickHouse, TimescaleDB)
│       ├── kafka/             # Kafka producer/consumer
│       ├── listener/          # Telemetry & Anomaly listeners
│       ├── simulator/         # IoT device simulator
│       └── websocket/         # WebSocket server for real-time alerts
├── docker/                    # Docker Compose configuration
├── scripts/                   # Setup & utility scripts
└── package.json
```

## Quick Start

### 1. Install Dependencies

```bash
yarn install
```

### 2. Start Infrastructure (First Time Setup)

This starts Docker containers (Kafka, Flink, TimescaleDB, ClickHouse) and creates required database tables and Kafka topics:

```bash
yarn setup
```

### 3. Deploy Flink Job (Optional)

Deploy the anomaly detection Flink job:

```bash
yarn deploy:flink
```

### 4. Start the Application

Run the telemetry listener, anomaly listener, and IoT simulator:

```bash
yarn start
```

### 5. Open the Dashboard

**Option A - Direct file:**
Open `apps/frontend/index.html` in your browser.

**Option B - HTTP server:**
```bash
yarn start:frontend
```
Then open http://localhost:8080

## Available Scripts

| Script | Description |
|--------|-------------|
| `yarn setup` | Start Docker containers and initialize databases/Kafka topics |
| `yarn start` | Run telemetry listener, anomaly listener, and IoT simulator |
| `yarn start:frontend` | Serve the frontend dashboard on port 8080 |
| `yarn deploy:flink` | Deploy the Flink anomaly detection job |
| `yarn purge` | Clear all data from databases and Kafka topics |

## Ports

| Service | Port |
|---------|------|
| Kafka | 9092 |
| Flink UI | 8081 |
| TimescaleDB | 5432 |
| ClickHouse | 8123 |
| WebSocket Server | 3001 |
| Frontend (HTTP) | 8080 |

## Anomaly Types

The system detects the following anomaly types:

| Type | Description | Severity Levels |
|------|-------------|-----------------|
| **TEMPERATURE** | Temperature exceeds baseline | CRITICAL (>10°C), HIGH (>5°C), MEDIUM |
| **ROUTE_DEVIATION** | Device deviates from expected route | CRITICAL (>10km), HIGH (>5km), MEDIUM |

## Frontend Features

- **Real-time alerts** - Anomalies appear instantly via WebSocket
- **Severity color-coding** - Critical (red), High (orange), Medium (yellow)
- **Stats dashboard** - Live counts for total/critical/high/medium alerts
- **Auto-reconnect** - Automatically reconnects if connection drops
- **Sound notifications** - Optional audio alerts (toggle with 🔔 button)

## Database Schema

### TimescaleDB (Alerting & Incidents)

```sql
-- Anomalies table with hypertable for time-series
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
  lon DOUBLE PRECISION
);
```

### ClickHouse (Analytics)

```sql
-- Anomalies table with ReplacingMergeTree for deduplication
CREATE TABLE anomalies (
  asset_id String,
  type LowCardinality(String),
  severity LowCardinality(String),
  ts DateTime64(3),
  current_temperature Float32,
  baseline_temperature Float32,
  distance_from_route_km Float32,
  lat Float64,
  lon Float64
) ENGINE = ReplacingMergeTree()
ORDER BY (asset_id, ts);
```

## Troubleshooting

### WebSocket "Connecting..." or "Disconnected"

The anomaly listener must be running for the WebSocket server to be available:
```bash
yarn start
```

### Kafka Connection Issues

Ensure Docker containers are running:
```bash
docker ps
```

If not running, start them:
```bash
cd docker && docker compose up -d
```

### Reset Everything

To clear all data and start fresh:
```bash
yarn purge
yarn setup
```

## License

MIT
