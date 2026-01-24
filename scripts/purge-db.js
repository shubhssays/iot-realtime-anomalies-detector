import { createClient } from "@clickhouse/client";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

/**
 * Purges all telemetry data from both ClickHouse and TimescaleDB.
 * 
 * This script performs the following operations:
 * 1. Truncates the telemetry table in ClickHouse and optimizes storage
 * 2. Truncates the telemetry hypertable in TimescaleDB and runs VACUUM
 * 
 * WARNING: This operation is irreversible and will delete ALL data.
 */

async function purgeClickHouse() {
  const client = createClient({
    url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
    username: process.env.CLICKHOUSE_USER || "admin",
    password: process.env.CLICKHOUSE_PASSWORD || "secret",
    database: process.env.CLICKHOUSE_DB || "telemetry",
  });

  try {
    console.log("🗑️  Purging ClickHouse data...");

    // TRUNCATE TABLE removes all data efficiently
    await client.command({
      query: "TRUNCATE TABLE IF EXISTS telemetry",
    });


    console.log("   ✅ Telemetry table truncated");

    await client.command({
      query: "TRUNCATE TABLE IF EXISTS anomalies",
    });

    console.log("   ✅ anomalies table truncated");

    // OPTIMIZE TABLE forces merge of data parts and reclaims disk space
    // FINAL ensures all parts are merged into one
    await client.command({
      query: "OPTIMIZE TABLE telemetry FINAL",
    });
    console.log("   ✅ Table optimized (storage reclaimed)");

    console.log("✅ ClickHouse purge completed");
  } catch (error) {
    console.error("❌ ClickHouse purge failed:", error.message);
    throw error;
  } finally {
    await client.close();
  }
}

async function purgeTimescaleDB() {
  const client = new Client({
    host: process.env.TIMESCALE_HOST || "localhost",
    port: parseInt(process.env.TIMESCALE_PORT) || 5432,
    database: process.env.TIMESCALE_DB || "telemetry",
    user: process.env.TIMESCALE_USER || "postgres",
    password: process.env.TIMESCALE_PASSWORD || "postgres",
  });

  try {
    console.log("🗑️  Purging TimescaleDB data...");

    await client.connect();

    // TRUNCATE is faster than DELETE for removing all rows
    // CASCADE handles any dependent objects
    await client.query("TRUNCATE TABLE telemetry CASCADE;");
    console.log("   ✅ Telemetry hypertable truncated");

    await client.query("TRUNCATE TABLE anomalies CASCADE;");
    console.log("   ✅ anomalies table truncated");

    // VACUUM FULL reclaims storage and defragments the table
    // ANALYZE updates statistics for query planner
    await client.query("VACUUM FULL ANALYZE telemetry;");
    await client.query("VACUUM FULL ANALYZE anomalies;");
    console.log("   ✅ VACUUM FULL completed (storage reclaimed)");

    // For hyper tables, also reorder chunks for optimal performance
    // This is optional but helps with query performance after bulk deletes
    try {
      await client.query(`
        SELECT reorder_chunk(chunk, 'telemetry_asset_id_ts_idx')
        FROM show_chunks('telemetry') AS chunk;
      `);
      console.log("   ✅ Chunks reordered");
    } catch (reorderError) {
      // Reorder may fail if no chunks exist or index doesn't exist
      console.log("   ⚠️  Chunk reorder skipped (no chunks or index)");
    }

    console.log("✅ TimescaleDB purge completed");
  } catch (error) {
    console.error("❌ TimescaleDB purge failed:", error.message);
    throw error;
  } finally {
    await client.end();
  }
}

async function purgeAllDatabases() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║       DATABASE PURGE UTILITY               ║");
  console.log("║  ⚠️  WARNING: This will DELETE ALL DATA!   ║");
  console.log("╚════════════════════════════════════════════╝\n");

  const results = { clickhouse: false, timescale: false };

  // Purge both databases, continue even if one fails
  try {
    await purgeClickHouse();
    results.clickhouse = true;
  } catch (error) {
    console.error("ClickHouse purge error:", error.message);
  }

  console.log(""); // Blank line for readability

  try {
    await purgeTimescaleDB();
    results.timescale = true;
  } catch (error) {
    console.error("TimescaleDB purge error:", error.message);
  }

  // Summary
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║              PURGE SUMMARY                 ║");
  console.log("╠════════════════════════════════════════════╣");
  console.log(`║  ClickHouse:  ${results.clickhouse ? "✅ Success" : "❌ Failed "}                ║`);
  console.log(`║  TimescaleDB: ${results.timescale ? "✅ Success" : "❌ Failed "}                ║`);
  console.log("╚════════════════════════════════════════════╝");

  if (!results.clickhouse || !results.timescale) {
    process.exit(1);
  }
}

purgeAllDatabases()
  .then(() => {
    console.log("\n🎉 All databases purged successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n💥 Purge operation failed:", err.message);
    process.exit(1);
  });
