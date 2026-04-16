"""
Sample Python FastAPI Application with OpenTelemetry Instrumentation
"""
import asyncio
import logging
import random
import time
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from opentelemetry import trace
from opentelemetry.trace import SpanKind, Status, StatusCode

# Import tracing configuration
from tracing import instrument_app, tracer, meter

# Configure logging
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Python OpenTelemetry Sample App",
    description="Sample Python application with OpenTelemetry instrumentation",
    version="1.0.0"
)

# Instrument the FastAPI app
instrument_app(app)

# Create custom metrics
request_counter = meter.create_counter(
    "http_requests_total",
    description="Total number of HTTP requests",
)

request_duration = meter.create_histogram(
    "http_request_duration_seconds",
    description="HTTP request duration in seconds",
)

active_requests = meter.create_up_down_counter(
    "http_requests_active",
    description="Number of active HTTP requests",
)

# In-memory data
items_db = {
    1: {"id": 1, "name": "Widget", "price": 19.99, "stock": 100},
    2: {"id": 2, "name": "Gadget", "price": 39.99, "stock": 50},
    3: {"id": 3, "name": "Doohickey", "price": 9.99, "stock": 200},
}


@app.middleware("http")
async def metrics_middleware(request, call_next):
    """Middleware to track request metrics"""
    start_time = time.time()
    active_requests.add(1, {"method": request.method, "route": request.url.path})
    
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        
        request_counter.add(1, {
            "method": request.method,
            "route": request.url.path,
            "status": response.status_code,
        })
        
        request_duration.record(duration, {
            "method": request.method,
            "route": request.url.path,
            "status": response.status_code,
        })
        
        return response
    finally:
        active_requests.add(-1, {"method": request.method, "route": request.url.path})


@app.get("/")
async def root():
    """Root endpoint"""
    span = trace.get_current_span()
    span.set_attribute("custom.attribute", "root-endpoint")
    span.add_event("Processing root request")
    
    logger.info("Root endpoint accessed")
    
    return {
        "message": "Welcome to Python OpenTelemetry Sample App",
        "version": "1.0.0",
        "framework": "FastAPI",
        "endpoints": [
            "GET /",
            "GET /items/{item_id}",
            "GET /slow",
            "GET /error",
            "GET /health",
            "GET /metrics-demo",
        ]
    }


@app.get("/items/{item_id}")
async def get_item(item_id: int):
    """Get item by ID"""
    with tracer.start_as_current_span("fetch-item", kind=SpanKind.INTERNAL) as span:
        span.set_attribute("item.id", item_id)
        
        # Simulate database query delay
        await asyncio.sleep(random.uniform(0.01, 0.1))
        
        if item_id not in items_db:
            logger.warning(f"Item not found: {item_id}")
            span.set_status(Status(StatusCode.ERROR, "Item not found"))
            span.set_attribute("error", True)
            raise HTTPException(status_code=404, detail="Item not found")
        
        item = items_db[item_id]
        span.set_attribute("item.name", item["name"])
        span.set_attribute("item.price", item["price"])
        span.add_event("Item fetched successfully", {"item_id": item_id})
        
        logger.info(f"Item fetched: {item_id}")
        return item


@app.get("/slow")
async def slow_endpoint():
    """Simulate a slow endpoint"""
    with tracer.start_as_current_span("slow-operation") as span:
        span.set_attribute("operation.type", "slow")
        
        logger.warning("Slow endpoint called")
        
        # Simulate slow operation
        duration = random.uniform(2.0, 3.0)
        await asyncio.sleep(duration)
        
        span.add_event("Slow operation completed", {"duration": duration})
        
        return {
            "message": "This was a slow operation",
            "duration": f"{duration:.2f} seconds"
        }


@app.get("/error")
async def error_endpoint():
    """Intentionally raise an error for testing"""
    span = trace.get_current_span()
    
    error_message = "This is an intentional error for testing"
    logger.error(f"Intentional error: {error_message}")
    
    try:
        # Simulate an error
        raise ValueError(error_message)
    except ValueError as e:
        span.record_exception(e)
        span.set_status(Status(StatusCode.ERROR, str(e)))
        span.set_attribute("error.type", "ValueError")
        
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics-demo")
async def metrics_demo():
    """Demonstrate custom metrics"""
    with tracer.start_as_current_span("metrics-demonstration") as span:
        # Create some random metrics
        processing_time = random.uniform(0.1, 0.5)
        items_processed = random.randint(1, 100)
        
        # Record custom metrics using attributes
        span.set_attribute("demo.processing_time", processing_time)
        span.set_attribute("demo.items_processed", items_processed)
        span.add_event("Metrics recorded", {
            "processing_time": processing_time,
            "items_processed": items_processed,
        })
        
        await asyncio.sleep(processing_time)
        
        logger.info(f"Processed {items_processed} items in {processing_time:.2f}s")
        
        return {
            "processing_time": processing_time,
            "items_processed": items_processed,
            "timestamp": time.time(),
        }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    span = trace.get_current_span()
    span.record_exception(exc)
    span.set_status(Status(StatusCode.ERROR, str(exc)))
    
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "detail": str(exc)}
    )


if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting Python sample app")
    uvicorn.run(app, host="0.0.0.0", port=8000)
