"""
OpenTelemetry Tracing Configuration for Python Application
This module configures OpenTelemetry SDK with OTLP exporters
"""
import logging
import os
from opentelemetry import trace, metrics
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION, DEPLOYMENT_ENVIRONMENT
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# Get configuration from environment
service_name = os.getenv('OTEL_SERVICE_NAME', 'python-sample-app')
otlp_endpoint = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://otel-collector:4318')

# Configure resource attributes
resource = Resource(attributes={
    SERVICE_NAME: service_name,
    SERVICE_VERSION: "1.0.0",
    DEPLOYMENT_ENVIRONMENT: "local",
    "service.instance.id": f"{os.getenv('HOSTNAME', 'localhost')}-{os.getpid()}",
})

# Configure trace provider
trace_provider = TracerProvider(resource=resource)
trace_exporter = OTLPSpanExporter(
    endpoint=f"{otlp_endpoint}/v1/traces",
)
trace_provider.add_span_processor(BatchSpanProcessor(trace_exporter))
trace.set_tracer_provider(trace_provider)

# Configure metrics provider
metric_exporter = OTLPMetricExporter(
    endpoint=f"{otlp_endpoint}/v1/metrics",
)
metric_reader = PeriodicExportingMetricReader(
    exporter=metric_exporter,
    export_interval_millis=10000,  # Export every 10 seconds
)
meter_provider = MeterProvider(
    resource=resource,
    metric_readers=[metric_reader]
)
metrics.set_meter_provider(meter_provider)

# Configure logs provider
logger_provider = LoggerProvider(resource=resource)
log_exporter = OTLPLogExporter(
    endpoint=f"{otlp_endpoint}/v1/logs",
)
logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
set_logger_provider(logger_provider)

# Configure standard logging to send to OpenTelemetry
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Add OpenTelemetry handler to root logger
handler = LoggingHandler(level=logging.NOTSET, logger_provider=logger_provider)
logging.getLogger().addHandler(handler)

logger = logging.getLogger(__name__)
logger.info(f"OpenTelemetry SDK initialized for {service_name}")
logger.info(f"Exporting to: {otlp_endpoint}")

# Get tracer and meter instances
tracer = trace.get_tracer(__name__, "1.0.0")
meter = metrics.get_meter(__name__, "1.0.0")

def instrument_app(app):
    """Instrument FastAPI application"""
    FastAPIInstrumentor.instrument_app(app)
    logger.info("FastAPI instrumentation complete")
