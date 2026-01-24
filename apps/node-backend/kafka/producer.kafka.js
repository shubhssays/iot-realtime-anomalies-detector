import { Kafka } from "kafkajs";

/**
 * Kafka Producer singleton class for sending IoT telemetry data.
 * Implements the Singleton pattern to ensure only one producer instance exists.
 * 
 * @class KafkaProducer
 * @example
 * // How to use:
 * import { KafkaProducer } from './producer.kafka.js';
 * 
 * // Get the singleton instance
 * const producer = KafkaProducer.getInstance();
 * 
 * // Connect to Kafka
 * await producer.connect();
 * 
 * // Send telemetry data
 * await producer.sendTelemetry({
 *   assetId: 'sensor-001',
 *   temperature: 25.5,
 *   timestamp: Date.now()
 * });
 */

/**
 * Singleton instance of KafkaProducer
 * @static
 * @type {KafkaProducer|null}
 */

/**
 * Creates a new KafkaProducer instance or returns existing singleton instance.
 * Initializes Kafka client with idempotent producer configuration.
 * @constructor
 */

/**
 * Gets the singleton instance of KafkaProducer.
 * Creates a new instance if one doesn't exist.
 * 
 * @static
 * @returns {KafkaProducer} The singleton KafkaProducer instance
 */

/**
 * Connects the producer to the Kafka broker.
 * Must be called before sending any messages.
 * 
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If connection to Kafka broker fails
 */

/**
 * Sends IoT telemetry event data to the 'iot.telemetry' topic.
 * Uses the assetId as the message key for partitioning.
 * 
 * @async
 * @param {Object} event - The telemetry event object
 * @param {string} event.assetId - The unique identifier of the IoT asset
 * @returns {Promise<void>}
 * @throws {Error} If sending message fails or producer is not connected
 */
export class KafkaProducer {
    static instance = null;

    constructor() {
        if (KafkaProducer.instance) {
            return KafkaProducer.instance;
        }

        this.kafka = new Kafka({
            clientId: "iot-simulator",
            brokers: ["localhost:9092"]
        });

        this.producer = this.kafka.producer({
            allowAutoTopicCreation: false,
            idempotent: true
        });

        KafkaProducer.instance = this;
    }

    static getInstance() {
        if (!KafkaProducer.instance) {
            KafkaProducer.instance = new KafkaProducer();
        }
        return KafkaProducer.instance;
    }

    async connect() {
        await this.producer.connect();
        console.log("Kafka producer connected");
    }

    async sendTelemetry(event) {
        await this.producer.send({
            topic: "iot.telemetry",
            messages: [
                {
                    key: event.assetId,
                    value: JSON.stringify(event)
                }
            ]
        });
    }

    /**
     * Sends a batch of telemetry events to Kafka.
     * Optimized for high-throughput scenarios.
     * 
     * @async
     * @param {Array<Object>} messages - Array of message objects with key and value
     * @param {Object} options - Optional configuration
     * @param {number} options.compression - Compression type (0=none, 1=gzip, 2=snappy)
     * @returns {Promise<void>}
     */
    async sendBatch(messages, options = {}) {
        await this.producer.send({
            topic: "iot.telemetry",
            messages,
            compression: options.compression || 0,
        });
    }
}
