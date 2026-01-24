import { createClient } from "@clickhouse/client";

// ClickHouse client singleton
const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "admin",
  password: process.env.CLICKHOUSE_PASSWORD || "secret",
  database: process.env.CLICKHOUSE_DB || "telemetry",
});

/**
 * Performs a direct bulk insert to ClickHouse.
 * Used for reliable batch processing where we need to confirm writes before committing offsets.
 *
 * @param {Array} rows - Array of telemetry row objects to insert
 * @returns {Promise} Resolves when insert is complete
 */
export async function bulkInsertToClickHouse(rows) {
  if (rows.length === 0) return;

  await clickhouse.insert({
    table: "telemetry",
    values: rows,
    format: "JSONEachRow",
  });
}

export { clickhouse };
