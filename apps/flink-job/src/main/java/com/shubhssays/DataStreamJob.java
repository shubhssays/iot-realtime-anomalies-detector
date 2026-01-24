package com.shubhssays;

import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.state.ValueState;
import org.apache.flink.api.common.state.ValueStateDescriptor;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.connector.kafka.sink.KafkaSink;
import org.apache.flink.connector.kafka.sink.KafkaRecordSerializationSchema;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.KeyedProcessFunction;
import org.apache.flink.util.Collector;
import org.apache.flink.api.common.serialization.SimpleStringSchema;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Flink streaming job for real-time IoT anomaly detection.
 * Detects temperature anomalies and route deviations from telemetry data.
 */
public class DataStreamJob {

	private static final ObjectMapper MAPPER = new ObjectMapper();

	// Temperature anomaly: current temp exceeds rolling average by this threshold
	private static final double TEMP_THRESHOLD_DELTA = 3.0;   // °C above rolling avg
	
	// Route anomaly: distance between consecutive GPS points exceeds this threshold
	private static final double ROUTE_RADIUS_KM = 3.0;

	public static void main(String[] args) throws Exception {

		// Initialize Flink streaming execution environment
		StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

		// Configure Kafka source to read IoT telemetry data
		KafkaSource<String> source = KafkaSource.<String>builder()
				   .setBootstrapServers("redpanda:29092")
				.setTopics("iot.telemetry")
				.setGroupId("flink-anomaly-detector")
				.setStartingOffsets(OffsetsInitializer.latest())
				.setValueOnlyDeserializer(new SimpleStringSchema())
				.build();

		// Create data stream from Kafka source
		DataStream<String> telemetry =
				env.fromSource(source, WatermarkStrategy.noWatermarks(), "iot-source");

		// Process telemetry stream: key by assetId and detect anomalies
		DataStream<String> anomalies =
				telemetry
						.keyBy(json -> MAPPER.readTree(json).get("assetId").asText())
						.process(new AnomalyDetector());

		// Configure Kafka sink to write detected anomalies
		KafkaSink<String> sink = KafkaSink.<String>builder()
				       .setBootstrapServers("redpanda:29092")
				.setRecordSerializer(
						KafkaRecordSerializationSchema.builder()
								.setTopic("iot.anomalies")
								.setValueSerializationSchema(new SimpleStringSchema())
								.build())
				.build();

		// Write anomalies to Kafka and print to console
		anomalies.sinkTo(sink);
		anomalies.print("ANOMALY");

		// Execute the Flink job
		env.execute("IoT Anomaly Detector");
	}

	// --------------------------------------------------------

	/**
	 * Keyed process function that maintains state per asset and detects:
	 * 1. Temperature anomalies (temp > rolling average + threshold)
	 * 2. Route deviations (distance between GPS points > threshold)
	 */
	static class AnomalyDetector extends KeyedProcessFunction<String, String, String> {

		// State: rolling average of temperature readings
		private transient ValueState<Double> tempAvg;
		
		// State: count of temperature readings for average calculation
		private transient ValueState<Long> tempCount;
		
		// State: last known latitude for route deviation detection
		private transient ValueState<Double> lastLat;
		
		// State: last known longitude for route deviation detection
		private transient ValueState<Double> lastLon;

		/**
		 * Initialize state variables for this keyed stream.
		 */
		@Override
		public void open(org.apache.flink.configuration.Configuration cfg) {
			tempAvg = getRuntimeContext().getState(
					new ValueStateDescriptor<>("tempAvg", Double.class));
			tempCount = getRuntimeContext().getState(
					new ValueStateDescriptor<>("tempCount", Long.class));
			lastLat = getRuntimeContext().getState(
					new ValueStateDescriptor<>("lastLat", Double.class));
			lastLon = getRuntimeContext().getState(
					new ValueStateDescriptor<>("lastLon", Double.class));
		}

		/**
		 * Process each telemetry event and detect anomalies.
		 * 
		 * @param value The JSON telemetry event
		 * @param ctx Process function context
		 * @param out Collector for emitting anomaly events
		 */
		@Override
		public void processElement(String value, Context ctx, Collector<String> out) throws Exception {
			// Parse incoming JSON telemetry
			JsonNode json = MAPPER.readTree(value);

			String assetId = json.get("assetId").asText();
			double temp = json.get("telemetry").get("temperature").asDouble();
			double lat = json.get("gps").get("lat").asDouble();
			double lon = json.get("gps").get("lon").asDouble();
			long ts = json.get("timestamp").asLong();

			// -------- Temperature anomaly detection --------
			// Update rolling average
			Double avg = tempAvg.value();
			Long count = tempCount.value();

			if (avg == null) {
				// First reading for this asset
				avg = temp;
				count = 1L;
			} else {
				// Update rolling average with new reading
				avg = (avg * count + temp) / (count + 1);
				count++;
			}

			// Persist updated state
			tempAvg.update(avg);
			tempCount.update(count);

			// Emit anomaly if temperature exceeds threshold
			if (temp > avg + TEMP_THRESHOLD_DELTA) {
				out.collect(buildTempAnomaly(assetId, temp, avg, ts));
			}

			// -------- Route deviation detection --------
			Double prevLat = lastLat.value();
			Double prevLon = lastLon.value();

			if (prevLat != null) {
				// Calculate distance from previous GPS position
				double distKm = haversine(prevLat, prevLon, lat, lon);
				
				// Emit anomaly if distance exceeds threshold
				if (distKm > ROUTE_RADIUS_KM) {
					out.collect(buildRouteAnomaly(assetId, lat, lon, distKm, ts));
				}
			}

			// Update GPS state for next comparison
			lastLat.update(lat);
			lastLon.update(lon);
		}

		/**
		 * Build JSON string for temperature anomaly event.
		 */
		private String buildTempAnomaly(String asset, double temp, double avg, long ts) throws Exception {
			ObjectNode n = MAPPER.createObjectNode();
			n.put("assetId", asset);
			n.put("type", "TEMPERATURE");
			n.put("value", temp);
			n.put("baseline", avg);
			n.put("timestamp", ts);
			return MAPPER.writeValueAsString(n);
		}

		/**
		 * Build JSON string for route deviation anomaly event.
		 */
		private String buildRouteAnomaly(String asset, double lat, double lon, double km, long ts) throws Exception {
			ObjectNode n = MAPPER.createObjectNode();
			n.put("assetId", asset);
			n.put("type", "ROUTE_DEVIATION");
			n.put("lat", lat);
			n.put("lon", lon);
			n.put("distanceKm", km);
			n.put("timestamp", ts);
			return MAPPER.writeValueAsString(n);
		}

		/**
		 * Calculate great-circle distance between two GPS coordinates using Haversine formula.
		 * 
		 * @return Distance in kilometers
		 */
		private double haversine(double lat1, double lon1, double lat2, double lon2) {
			double R = 6371; // Earth's radius in kilometers
			double dLat = Math.toRadians(lat2 - lat1);
			double dLon = Math.toRadians(lon2 - lon1);
			double a =
					Math.sin(dLat / 2) * Math.sin(dLat / 2)
							+ Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
							* Math.sin(dLon / 2) * Math.sin(dLon / 2);
			return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		}
	}
}
