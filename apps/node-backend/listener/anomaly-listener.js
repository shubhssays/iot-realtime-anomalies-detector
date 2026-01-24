import "dotenv/config";
import { Kafka } from "kafkajs";
import { bulkInsertToClickHouseAnomalies } from "../db/clickhouse.js";
import { bulkInsertToTimescaleAnomalies } from "../db/timescale.js";

/**
 * Kafka Listener for Anomalies
 * Consumes anomaly events from Kafka and bulk inserts into TimescaleDB and ClickHouse.
 */
async function main() {
  console.log("🚨 Starting Kafka Anomaly Listener...");

  const kafka = new Kafka({
    clientId: "iot-anomaly-backend",
    brokers: ["localhost:9092"],
  });

  const consumer = kafka.consumer({ groupId: "anomaly-writers" });

  await consumer.connect();
  await consumer.subscribe({ topic: "iot.anomalies", fromBeginning: false });

  process.on("SIGINT", async () => {
    await consumer.disconnect();
    process.exit(0);
  });

  await consumer.run({
    eachBatchAutoResolve: false,
    eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary }) => {
      const rows = batch.messages.map((message) => {
        const event = JSON.parse(message.value.toString());
        return transformAnomalyEventToRow(event);
      });
      try {
        await Promise.all([
          bulkInsertToClickHouseAnomalies(rows),
          bulkInsertToTimescaleAnomalies(rows),
        ]);
      } catch (error) {
        console.error("❌ Anomaly batch insert failed:", error.message);
        return;
      }
      const lastMessage = batch.messages[batch.messages.length - 1];
      resolveOffset(lastMessage.offset);
      await commitOffsetsIfNecessary();
      await heartbeat();
    },
  });
}

function transformAnomalyEventToRow(event) {
  // Derive severity based on anomaly type and values
  let severity = event.severity || "MEDIUM";
  if (event.type === "TEMPERATURE") {
    // Higher temperature delta = higher severity
    const delta = (event.value || 0) - (event.baseline || 0);
    severity = delta > 10 ? "CRITICAL" : delta > 5 ? "HIGH" : "MEDIUM";
  } else if (event.type === "ROUTE_DEVIATION") {
    // Larger deviation = higher severity  
    const distKm = event.distanceKm || 0;
    severity = distKm > 10 ? "CRITICAL" : distKm > 5 ? "HIGH" : "MEDIUM";
  }

  return {
    asset_id: event.assetId,
    type: event.type,
    severity: severity,
    ts: new Date(event.timestamp),
    // Map Flink output fields to database schema
    current_temperature: event.value ?? null,
    baseline_temperature: event.baseline ?? null,
    distance_from_route_km: event.distanceKm ?? null,
    lat: event.lat ?? null,
    lon: event.lon ?? null,
  };
}

// Notification trigger stub (not implemented)
export function triggerAnomalyNotification(anomalyEvent) {
  // TODO: Implement notification via websocket, email, or push
  console.log("🔔 Anomaly notification triggered:", anomalyEvent) ;
}

main();
