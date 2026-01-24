import { Client } from "pg";

/**
 * Creates and configures a TimescaleDB hypertable for storing IoT telemetry data.
 *
 * This function performs the following operations:
 * 1. Connects to a PostgreSQL database
 * 2. Enables the TimescaleDB extension
 * 3. Creates a telemetry table with asset_id, timestamp, temperature, and speed columns
 * 4. Converts the table into a TimescaleDB hypertable
 *
 * **Importance of Hypertable:**
 * A hypertable is TimescaleDB's core abstraction that optimizes PostgreSQL for time-series data.
 * It automatically partitions data by time chunks, enabling:
 * - Faster query performance on time-based queries
 * - Efficient data retention policies and compression
 * - Improved insert performance for high-volume time-series data
 * - Seamless scalability as data grows over time
 *
 * @async
 * @function createTimeSeriesDBTables
 * @throws {Error} If database connection fails or queries cannot be executed
 * @returns {Promise<void>} Resolves when all tables are created successfully
 *
 * @requires pg.Client - PostgreSQL client for database operations
 * @requires process.env.POSTGRES_PASSWORD - Environment variable for database authentication
 *
 * @example
 * await createTimeSeriesDBTables();
 */
async function createTimeSeriesDBTables() {
  const client = new Client({
    host: "localhost",
    port: 5432,
    user: "postgres",
    database: "telemetry",
    password: process.env.POSTGRES_PASSWORD || "postgres",
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL database");

    // Enable TimescaleDB extension
    await client.query("CREATE EXTENSION IF NOT EXISTS timescaledb;");
    console.log("TimescaleDB extension enabled");

      // Create telemetry table
      await client.query(`
          CREATE TABLE IF NOT EXISTS telemetry (
            asset_id TEXT,
            ts TIMESTAMPTZ,
            temperature DOUBLE PRECISION,
            speed DOUBLE PRECISION,
            PRIMARY KEY (asset_id, ts)
          );
        `);
      console.log("Telemetry table created");

      // Create iot_anomalies table (operational truth)
      await client.query(`
        CREATE TABLE IF NOT EXISTS iot_anomalies (
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
          created_at TIMESTAMPTZ DEFAULT now(),
          PRIMARY KEY (asset_id, type, ts)
        );
      `);
      console.log("iot_anomalies table created");

      await client.query(`SELECT create_hypertable('iot_anomalies', 'ts', if_not_exists => TRUE);`);
      console.log("iot_anomalies hypertable created");

      // Add recommended indexes
      await client.query(`CREATE INDEX IF NOT EXISTS idx_anomaly_asset_time ON iot_anomalies (asset_id, ts DESC);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_anomaly_severity ON iot_anomalies (severity, ts DESC);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_anomaly_open ON iot_anomalies (acknowledged, ts DESC);`);
      console.log("iot_anomalies indexes created");

      // Convert to hypertable
      await client.query(`
          SELECT create_hypertable('telemetry', 'ts', if_not_exists => TRUE);
        `);
    console.log("Hypertable created successfully");
  } catch (error) {
    console.error("Error:", error.message);
    throw error;
  } finally {
    await client.end();
    console.log("Database connection closed");
  }
}

createTimeSeriesDBTables()
  .then(() => console.log("Setup completed successfully"))
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
