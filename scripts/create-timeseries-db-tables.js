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
