import { Kafka } from "kafkajs";
import { bulkInsertToClickHouse } from "../db/clickhouse.js";
import { bulkInsertToTimescale } from "../db/timescale.js";

/**
 * Retry helper with exponential backoff.
 * Retries a function on failure with increasing delays between attempts.
 *
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry configuration
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.baseDelay - Initial delay in ms (default: 1000)
 * @param {string} options.name - Operation name for logging (default: 'Operation')
 * @returns {Promise} Result of the function
 * @throws {Error} After all retries are exhausted
 */
async function withRetry(fn, { maxRetries = 3, baseDelay = 1000, name = "Operation" } = {}) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`${name} failed after ${maxRetries} attempts:`, error.message);
        throw error;
      }
      // Exponential backoff: 1s, 2s, 4s, ...
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`${name} attempt ${attempt} failed, retrying in ${delay}ms...`, error.message);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export class KafkaConsumer {
  static #instance = null;

  // Cooldown period before auto-resuming after a failure (in ms)
  static PAUSE_COOLDOWN_MS = 30000;

  // Topic name constant
  static TOPIC = "iot.telemetry";

  constructor() {
    if (KafkaConsumer.#instance) {
      return KafkaConsumer.#instance;
    }

    this.kafka = new Kafka({
      clientId: "iot-backend",
      brokers: ["localhost:9092"],
    });

    this.consumer = this.kafka.consumer({
      groupId: "telemetry-writers",
    });

    // Track if consumer is currently paused
    this.isPaused = false;

    KafkaConsumer.#instance = this;
  }

  static getInstance() {
    if (!KafkaConsumer.#instance) {
      KafkaConsumer.#instance = new KafkaConsumer();
    }
    return KafkaConsumer.#instance;
  }

  /**
   * Pauses the consumer and schedules an automatic resume after cooldown.
   * Prevents crash loops when databases are unavailable.
   */
  async pauseWithAutoResume() {
    if (this.isPaused) return; // Already paused, don't stack timeouts

    this.isPaused = true;
    console.error(
      `⏸️  Pausing consumer for ${KafkaConsumer.PAUSE_COOLDOWN_MS / 1000}s due to persistent failures...`
    );

    this.consumer.pause([{ topic: KafkaConsumer.TOPIC }]);

    // Schedule auto-resume after cooldown
    setTimeout(async () => {
      console.log("▶️  Resuming consumer after cooldown...");
      this.consumer.resume([{ topic: KafkaConsumer.TOPIC }]);
      this.isPaused = false;
    }, KafkaConsumer.PAUSE_COOLDOWN_MS);
  }

  async start() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: KafkaConsumer.TOPIC,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachBatchAutoResolve: false,
      eachBatch: async ({
        batch,
        resolveOffset,
        heartbeat,
        commitOffsetsIfNecessary,
      }) => {
        // ============================================================
        // STEP 1: Collect all events from the batch
        // We parse all messages first without committing any offsets.
        // This allows us to process the entire batch atomically.
        // ============================================================
        const rows = batch.messages.map((message) => {
          const event = JSON.parse(message.value.toString());
          return this.transformToRow(event);
        });

        // ============================================================
        // STEP 2: Bulk insert to BOTH databases in parallel with retry
        // Each insert is wrapped with exponential backoff retry logic.
        // If either fails after all retries, we pause the consumer
        // instead of crashing. Messages will be redelivered on resume.
        // Since we have upsert logic (ON CONFLICT), reprocessing is safe.
        // ============================================================
        try {
          await Promise.all([
            withRetry(() => bulkInsertToClickHouse(rows), {
              name: "ClickHouse insert",
              maxRetries: 3,
              baseDelay: 1000,
            }),
            withRetry(() => bulkInsertToTimescale(rows), {
              name: "TimescaleDB insert",
              maxRetries: 3,
              baseDelay: 1000,
            }),
          ]);
        } catch (error) {
          // ============================================================
          // FAILURE HANDLING: Pause consumer instead of crashing
          // - Don't resolve offset → messages will be redelivered
          // - Pause consumer to prevent rapid retry loops
          // - Auto-resume after cooldown period
          // ============================================================
          console.error("❌ Batch processing failed:", error.message);
          await this.pauseWithAutoResume();
          return; // Exit without committing offset
        }

        // ============================================================
        // STEP 3: Resolve offset ONLY after successful DB writes
        // We only mark the LAST message's offset as processed.
        // This ensures at-least-once delivery semantics:
        // - If we crash before this point, messages will be redelivered
        // - Upsert logic in DBs handles duplicate processing gracefully
        // ============================================================
        const lastMessage = batch.messages[batch.messages.length - 1];
        resolveOffset(lastMessage.offset);

        // ============================================================
        // STEP 4: Commit offsets and send heartbeat
        // commitOffsetsIfNecessary() commits based on autoCommitInterval
        // heartbeat() keeps the consumer alive in the consumer group
        // ============================================================
        await commitOffsetsIfNecessary();
        await heartbeat();
      },
    });
  }

  /**
   * Transforms a Kafka event into a database row format.
   * This is a pure transformation with no side effects.
   * 
   * @param {Object} event - The parsed Kafka message event
   * @returns {Object} Row object ready for database insertion
   */
  transformToRow(event) {
    return {
      asset_id: event.assetId,
      ts: event.timestamp,
      temperature: event.telemetry.temperature,
      speed: event.telemetry.speed,
      lat: event.gps.lat,
      lon: event.gps.lon,
    };
  }
}
