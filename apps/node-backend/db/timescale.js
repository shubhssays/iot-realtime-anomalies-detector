import pg from "pg";

// PostgreSQL/TimescaleDB connection pool singleton
const pool = new pg.Pool({
  host: process.env.TIMESCALE_HOST || "localhost",
  port: parseInt(process.env.TIMESCALE_PORT) || 5432,
  database: process.env.TIMESCALE_DB || "telemetry",
  user: process.env.TIMESCALE_USER || "postgres",
  password: process.env.TIMESCALE_PASSWORD || "postgres",
});

/**
 * Performs a direct bulk insert to TimescaleDB.
 * Used for reliable batch processing where we need to confirm writes before committing offsets.
 * Uses ON CONFLICT DO NOTHING to handle upserts (idempotent for reprocessing).
 *
 * @param {Array} rows - Array of telemetry row objects to insert
 * @returns {Promise} Resolves when insert is complete
 */
export async function bulkInsertToTimescale(rows) {
  if (rows.length === 0) return;

  // Build parameterized query for bulk insert
  // Each row needs 4 parameters: asset_id, ts, temperature, speed
  // Cast timestamp to bigint to handle millisecond epoch values
  const values = rows
    .map(
      (_, i) =>
        `($${i * 4 + 1}, to_timestamp($${i * 4 + 2}::bigint / 1000.0), $${i * 4 + 3}, $${i * 4 + 4})`,
    )
    .join(",");

  const params = rows.flatMap((r) => [
    r.asset_id,
    r.ts,
    r.temperature,
    r.speed,
  ]);

  // ON CONFLICT ensures idempotency - safe for message reprocessing
  await pool.query(
    `INSERT INTO telemetry(asset_id, ts, temperature, speed) VALUES ${values} ON CONFLICT (asset_id, ts) DO NOTHING;`,
    params,
  );
}

export { pool };
