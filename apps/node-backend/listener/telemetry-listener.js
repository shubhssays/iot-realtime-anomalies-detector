import "dotenv/config";
import { KafkaConsumer } from "../kafka/consumer.kafka.js";

/**
 * Kafka Listener Entry Point
 * 
 * This service consumes IoT telemetry events from Kafka and persists them
 * to ClickHouse (for analytics) and TimescaleDB (for time-series queries).
 * 
 * Features:
 * - Bulk inserts for high throughput
 * - Retry with exponential backoff on transient failures
 * - Auto-pause and resume on persistent failures
 * - At-least-once delivery with idempotent writes
 */

async function main() {
  console.log("🚀 Starting Kafka Telemetry Listener...");

  const consumer = KafkaConsumer.getInstance();

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    try {
      await consumer.consumer.disconnect();
      console.log("✅ Kafka consumer disconnected");
      process.exit(0);
    } catch (error) {
      console.error("❌ Error during shutdown:", error.message);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await consumer.start();
    console.log("✅ Kafka consumer started and listening for telemetry events...");
  } catch (error) {
    console.error("❌ Failed to start Kafka consumer:", error.message);
    process.exit(1);
  }
}

main();
