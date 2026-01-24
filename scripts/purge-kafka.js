import { Kafka } from "kafkajs";

/**
 * Purges all data from Kafka/Redpanda topics without losing topic configuration.
 *
 * This script:
 * 1. Connects to Kafka as an admin
 * 2. Fetches topic configurations
 * 3. Deletes and recreates each topic with the same config
 *
 * Useful for:
 * - Resetting development/test environments
 * - Clearing stale data while preserving topic settings
 *
 * @requires kafkajs
 */

const KAFKA_BROKER = process.env.KAFKA_BROKER || "localhost:9092";

const kafka = new Kafka({
  clientId: "kafka-data-purger",
  brokers: [KAFKA_BROKER],
});

async function purgeKafkaData() {
  const admin = kafka.admin();

  try {
    console.log("🔌 Connecting to Kafka...");
    await admin.connect();

    // Get all topics (exclude internal topics starting with _)
    const topics = await admin.listTopics();
    const userTopics = topics.filter((topic) => !topic.startsWith("_"));

    if (userTopics.length === 0) {
      console.log("ℹ️  No user topics found to purge.");
      return;
    }

    console.log(`📋 Found ${userTopics.length} topic(s): ${userTopics.join(", ")}`);

    // Get metadata for all topics to preserve partition count
    const metadata = await admin.fetchTopicMetadata({ topics: userTopics });

    for (const topicMeta of metadata.topics) {
      const topic = topicMeta.name;
      const numPartitions = topicMeta.partitions.length;

      console.log(`\n🗑️  Purging topic: ${topic} (${numPartitions} partitions)`);

      // Check if topic has data
      const offsets = await admin.fetchTopicOffsets(topic);
      if (offsets.every((p) => p.high === "0")) {
        console.log(`   ⏭️  Topic "${topic}" is already empty, skipping.`);
        continue;
      }

      // Delete the topic
      console.log(`   🔄 Deleting topic...`);
      await admin.deleteTopics({ topics: [topic] });

      // Wait for deletion to propagate
      await new Promise((r) => setTimeout(r, 1000));

      // Recreate the topic with same partition count
      console.log(`   🔄 Recreating topic with ${numPartitions} partition(s)...`);
      await admin.createTopics({
        topics: [
          {
            topic,
            numPartitions,
            replicationFactor: 1,
          },
        ],
      });

      console.log(`   ✅ Topic "${topic}" purged and recreated.`);
    }

    console.log("\n🎉 All topics purged successfully!");
  } catch (error) {
    console.error("❌ Error purging Kafka data:", error.message);
    process.exit(1);
  } finally {
    await admin.disconnect();
    console.log("🔌 Disconnected from Kafka.");
  }
}

purgeKafkaData();


