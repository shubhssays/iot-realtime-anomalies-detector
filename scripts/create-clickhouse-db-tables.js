import { createClient } from "@clickhouse/client";
import dotenv from "dotenv";

dotenv.config();

// filepath: d:\Workspace\Github\iot-realtime-anomalies-detector\scripts\create-clickhouse-db-tables.js

/**
 * Creates and configures a ClickHouse table for storing IoT telemetry data.
 *
 * This function performs the following operations:
 * 1. Connects to a ClickHouse database
 * 2. Creates a telemetry table with asset_id, timestamp, temperature, and speed columns
 *
 * **MergeTree Engine:**
 * MergeTree is ClickHouse's most universal and powerful table engine for production use.
 * It provides:
 * - Fast data insertion with automatic sorting by ORDER BY key
 * - Efficient compression and storage optimization
 * - Fast queries on sorted columns (asset_id, ts)
 * - Support for data replication and partitioning
 * - Excellent performance for analytical queries on large datasets
 *
 * @async
 * @function createClickHouseDBTables
 * @throws {Error} If database connection fails or queries cannot be executed
 * @returns {Promise<void>} Resolves when table is created successfully
 *
 * @requires @clickhouse/client - ClickHouse client for database operations
 *
 * @example
 * await createClickHouseDBTables();
 */
async function createClickHouseDBTables() {
  const config = {
    host: process.env.CLICKHOUSE_HOST || "http://localhost:8123",
    username: process.env.CLICKHOUSE_USER || "admin",
    password: process.env.CLICKHOUSE_PASSWORD || "secret",
  };

  const dbClient = createClient(config);

  const client = createClient({
    ...config,
    database: "telemetry",
  });

  try {
    console.log("Connecting to ClickHouse...");

    // Create database with optimal settings for time-series data
    await dbClient.command({
      query: `
        CREATE DATABASE IF NOT EXISTS telemetry
        ENGINE = Atomic
        COMMENT 'IoT telemetry data storage'
      `,
    });

    console.log("Database 'telemetry' created/verified successfully");

    // Create telemetry table
    await client.command({
      query: `
          CREATE TABLE IF NOT EXISTS telemetry (
            asset_id String,
            ts DateTime,
            temperature Float32,
            speed Float32
          ) ENGINE = ReplacingMergeTree()
          PRIMARY KEY (asset_id, ts)
          ORDER BY (asset_id, ts)
        `,
    });

    console.log("Telemetry table created successfully");

    // Create anomalies table (analytics)
    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS anomalies (
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
        ) ENGINE = ReplacingMergeTree(version)
        PARTITION BY toYYYYMM(ts)
        ORDER BY (asset_id, ts)
      `,
    });
    console.log("anomalies table created successfully");

    // Verify table creation
    const result = await client.query({
      query: "SHOW TABLES",
      format: "JSONEachRow",
    });

    const tables = await result.json();
    console.log("Available tables:", tables);
  } catch (error) {
    console.error("Error:", error.message);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    throw error;
  } finally {
    try {
      await dbClient.close();
      await client.close();
      console.log("Database connection closed");
    } catch (closeError) {
      console.error("Error closing connections:", closeError.message);
    }
  }
}

createClickHouseDBTables()
  .then(() => console.log("Setup completed successfully"))
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
