import { KafkaProducer } from "../kafka/producer.kafka.js";
const producer = KafkaProducer.getInstance();

const ASSET_COUNT = 500;
const EVENTS_PER_SECOND = 5000;
const RUN_FOR_SECONDS = Infinity;


const ASSETS = Array.from({ length: ASSET_COUNT }, (_, i) => `shipment_${i}`);

function generateEvent(assetId) {
  return {
    assetId,
    timestamp: Date.now(),
    gps: {
      lat: 28 + Math.random(),
      lon: 77 + Math.random(),
    },
    telemetry: {
      temperature: 5 + Math.random() * 30,
      speed: Math.random() * 80,
    },
  };
}

async function start() {
  await producer.connect();

  while (RUN_FOR_SECONDS === Infinity || Date.now() < RUN_FOR_SECONDS * 1000) {
    const batch = [];

    for (let i = 0; i < EVENTS_PER_SECOND; i++) {
      const asset = ASSETS[i % ASSET_COUNT];
      batch.push({
        key: asset,
        value: JSON.stringify(generateEvent(asset)),
      });
    }

    // Use sendBatch for high-throughput batch sending with gzip compression
    await producer.sendBatch(batch, { compression: 1 });

    console.log(`Sent ${EVENTS_PER_SECOND} events`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

start().catch(console.error);
